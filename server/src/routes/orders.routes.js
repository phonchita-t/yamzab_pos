import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { buildBill, lineTotal, resolveTier, round2 } from '../lib/pricing.js';

const router = Router();
router.use(authenticate);

const SPICE = ['NONE', 'MILD', 'MEDIUM', 'HOT', 'THAI_HOT', 'EXTRA_THAI_HOT'];

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  spiceLevel: z.enum(SPICE).optional(),
  plaRa: z.boolean().optional(),
  note: z.string().optional().nullable(),
  optionIds: z.array(z.string().uuid()).optional().default([]),
});

const checkoutSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  customerId: z.string().uuid().optional().nullable(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
  tableLabel: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  manualDiscount: z.number().nonnegative().optional().default(0),
  pointsToRedeem: z.number().int().nonnegative().optional().default(0),
  taxRate: z.number().min(0).max(1).optional().default(0),
  serviceChargeRate: z.number().min(0).max(1).optional().default(0),
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'QR_PROMPTPAY', 'CREDIT_CARD']),
        amount: z.number().positive(),
        tendered: z.number().positive().optional(),
        reference: z.string().optional(),
      }),
    )
    .min(1),
});

/**
 * POS checkout: validates the cart against live prices, computes the bill,
 * writes the order + items + payments + loyalty movements atomically.
 */
router.post(
  '/checkout',
  requireRole('CASHIER'),
  validateBody(checkoutSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;

    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const optionIds = [...new Set(body.items.flatMap((i) => i.optionIds))];

    const [products, options, loyaltyConfig, tiers, customer] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } } }),
      optionIds.length ? prisma.option.findMany({ where: { id: { in: optionIds } } }) : [],
      prisma.loyaltyConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
      prisma.membershipTier.findMany(),
      body.customerId
        ? prisma.customer.findUnique({ where: { id: body.customerId }, include: { tier: true } })
        : null,
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const optionMap = new Map(options.map((o) => [o.id, o]));

    // Build priced line items
    const lines = body.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw Object.assign(new Error(`ไม่พบสินค้า ${item.productId}`), { status: 422 });
      if (!product.isAvailable || !product.isActive) {
        throw Object.assign(new Error(`"${product.nameTh || product.name}" ไม่พร้อมจำหน่าย`), { status: 409 });
      }
      const selectedOptions = item.optionIds.map((id) => {
        const opt = optionMap.get(id);
        if (!opt) throw Object.assign(new Error(`ไม่พบตัวเลือก ${id}`), { status: 422 });
        return opt;
      });
      const optionsTotal = round2(selectedOptions.reduce((s, o) => s + Number(o.priceDelta), 0));
      const unitPrice = Number(product.price);
      return {
        product,
        item,
        selectedOptions,
        unitPrice,
        optionsTotal,
        quantity: item.quantity,
        lineTotal: lineTotal({ unitPrice, optionsTotal, quantity: item.quantity }),
      };
    });

    if (customer && body.pointsToRedeem > customer.pointsBalance) {
      return res.status(409).json({ error: 'สมาชิกมีแต้มสะสมไม่เพียงพอสำหรับการแลก' });
    }

    const tierDiscountPct = customer?.tier ? Number(customer.tier.discountPercent) : 0;
    const pointsMultiplier = customer?.tier ? Number(customer.tier.pointsMultiplier) : 1;

    const bill = buildBill(lines, {
      manualDiscount: body.manualDiscount,
      tierDiscountPct,
      pointsToRedeem: customer ? body.pointsToRedeem : 0,
      loyaltyConfig,
      pointsMultiplier,
      taxRate: body.taxRate,
      serviceChargeRate: body.serviceChargeRate,
    });

    const paidTotal = round2(body.payments.reduce((s, p) => s + p.amount, 0));
    if (paidTotal + 0.01 < bill.total) {
      return res.status(422).json({ error: `ยอดชำระ (${paidTotal}) น้อยกว่ายอดที่ต้องชำระ (${bill.total})` });
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          cashierId: req.user.id,
          customerId: customer?.id ?? null,
          status: 'PENDING',
          orderType: body.orderType || 'DINE_IN',
          tableLabel: body.tableLabel || null,
          note: body.note || null,
          subtotal: bill.subtotal,
          discountAmount: bill.discountAmount,
          tierDiscount: bill.tierDiscount,
          pointsRedeemed: bill.pointsRedeemed,
          pointsValue: bill.pointsValue,
          taxAmount: bill.taxAmount,
          serviceCharge: bill.serviceCharge,
          total: bill.total,
          pointsEarned: bill.pointsEarned,
          paymentStatus: 'PAID',
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              nameSnapshot: l.product.nameTh || l.product.name,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              spiceLevel: l.item.spiceLevel || l.product.defaultSpice,
              plaRa: l.item.plaRa ?? false,
              optionsTotal: l.optionsTotal,
              lineTotal: l.lineTotal,
              note: l.item.note || null,
              options: {
                create: l.selectedOptions.map((o) => ({
                  optionId: o.id,
                  nameSnapshot: o.nameTh || o.name,
                  priceDelta: o.priceDelta,
                })),
              },
            })),
          },
          transactions: {
            create: body.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              tendered: p.tendered ?? null,
              changeGiven:
                p.method === 'CASH' && p.tendered ? round2(Math.max(0, p.tendered - p.amount)) : 0,
              reference: p.reference || null,
              status: 'PAID',
              processedById: req.user.id,
            })),
          },
        },
        include: { items: { include: { options: true } }, transactions: true },
      });

      // Decrement tracked inventory
      for (const l of lines) {
        if (l.product.trackInventory) {
          const balanceAfter = Number(l.product.stockQty) - l.quantity;
          await tx.product.update({ where: { id: l.product.id }, data: { stockQty: balanceAfter } });
          await tx.stockMovement.create({
            data: {
              productId: l.product.id, type: 'SALE', quantity: -l.quantity,
              balanceAfter, orderId: created.id, createdById: req.user.id,
            },
          });
        }
      }

      // Loyalty: redeem then earn
      if (customer) {
        let balance = customer.pointsBalance;
        if (bill.pointsRedeemed > 0) {
          balance -= bill.pointsRedeemed;
          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id, orderId: created.id, type: 'REDEEM',
              points: -bill.pointsRedeemed, balanceAfter: balance,
              note: `ใช้แต้มในออเดอร์ #${created.orderNumber}`, createdById: req.user.id,
            },
          });
        }
        if (bill.pointsEarned > 0) {
          balance += bill.pointsEarned;
          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id, orderId: created.id, type: 'EARN',
              points: bill.pointsEarned, balanceAfter: balance,
              note: `สะสมแต้มจากออเดอร์ #${created.orderNumber}`, createdById: req.user.id,
            },
          });
        }
        const newLifetime = customer.lifetimePoints + bill.pointsEarned;
        const newTier = resolveTier(newLifetime, tiers);
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            pointsBalance: balance,
            lifetimePoints: newLifetime,
            lifetimeSpend: { increment: bill.total },
            visitCount: { increment: 1 },
            tierId: newTier?.id ?? customer.tierId,
          },
        });
      }

      return created;
    });

    res.status(201).json({ order, bill });
  }),
);

/* --------------------------- Kitchen Display -------------------------- */

router.get(
  '/kds',
  asyncHandler(async (req, res) => {
    const statuses = String(req.query.status || 'PENDING,PREPARING').split(',');
    const orders = await prisma.order.findMany({
      where: { status: { in: statuses } },
      include: {
        items: { include: { options: true }, orderBy: { createdAt: 'asc' } },
        customer: { select: { fullName: true, phone: true } },
        cashier: { select: { fullName: true } },
      },
      orderBy: { placedAt: 'asc' },
    });
    res.json(orders);
  }),
);

router.patch(
  '/:id/status',
  validateBody(z.object({ status: z.enum(['PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED']) })),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const data = { status };
    if (status === 'PREPARING') data.preparedAt = new Date();
    if (status === 'COMPLETED') data.completedAt = new Date();
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { ...data, items: { updateMany: { where: {}, data: { kitchenStatus: status } } } },
      include: { items: true },
    });
    res.json(order);
  }),
);

router.patch(
  '/items/:itemId/status',
  validateBody(z.object({ status: z.enum(['PENDING', 'PREPARING', 'COMPLETED']) })),
  asyncHandler(async (req, res) => {
    const item = await prisma.orderItem.update({
      where: { id: req.params.itemId },
      data: { kitchenStatus: req.body.status },
    });
    res.json(item);
  }),
);

/* ------------------------------ History ------------------------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, customerId } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        ...(from || to
          ? { placedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: {
        items: true,
        transactions: true,
        customer: { select: { fullName: true, phone: true } },
        cashier: { select: { fullName: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 100,
    });
    res.json(orders);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        items: { include: { options: true } },
        transactions: true,
        customer: true,
        cashier: { select: { fullName: true } },
      },
    });
    res.json(order);
  }),
);

export default router;
