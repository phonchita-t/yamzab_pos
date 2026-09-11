import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { resolveTier } from '../lib/pricing.js';

const router = Router();
router.use(authenticate);

const customerInclude = {
  tier: true,
  loyaltyTransactions: { orderBy: { createdAt: 'desc' }, take: 10 },
};

/** Lookup by phone (cashier flow at checkout). */
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'กรุณาระบุเบอร์โทรศัพท์' });
    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: customerInclude,
    });
    if (!customer) return res.status(404).json({ error: 'ไม่พบสมาชิกที่ใช้เบอร์โทรนี้' });
    res.json(customer);
  }),
);

/** Free-text search (admin member view). */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { phone: { contains: q } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      include: { tier: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json(customers);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        ...customerInclude,
        orders: { orderBy: { placedAt: 'desc' }, take: 10, select: { id: true, orderNumber: true, total: true, placedAt: true, status: true } },
      },
    });
    res.json(customer);
  }),
);

const customerSchema = z.object({
  phone: z.string().min(6),
  fullName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  birthdate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/** Register a member (used inline during checkout). */
router.post(
  '/',
  validateBody(customerSchema),
  asyncHandler(async (req, res) => {
    const tiers = await prisma.membershipTier.findMany();
    const baseTier = resolveTier(0, tiers);
    const customer = await prisma.customer.create({
      data: {
        ...req.body,
        email: req.body.email || null,
        birthdate: req.body.birthdate ? new Date(req.body.birthdate) : null,
        tierId: baseTier?.id ?? null,
      },
      include: customerInclude,
    });
    res.status(201).json(customer);
  }),
);

router.patch(
  '/:id',
  validateBody(customerSchema.partial()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.birthdate) data.birthdate = new Date(data.birthdate);
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
      include: customerInclude,
    });
    res.json(customer);
  }),
);

/** Manual point adjustment (admin). */
router.post(
  '/:id/adjust-points',
  requireRole('ADMIN'),
  validateBody(z.object({ points: z.number().int(), note: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { points, note } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: req.params.id } });
      const balanceAfter = Math.max(0, customer.pointsBalance + points);
      await tx.loyaltyTransaction.create({
        data: {
          customerId: customer.id, type: 'ADJUST', points,
          balanceAfter, note, createdById: req.user.id,
        },
      });
      return tx.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimePoints: points > 0 ? customer.lifetimePoints + points : customer.lifetimePoints,
        },
        include: customerInclude,
      });
    });
    res.json(updated);
  }),
);

/* --------------------------- Loyalty config --------------------------- */

router.get(
  '/config/loyalty',
  asyncHandler(async (_req, res) => {
    const cfg = await prisma.loyaltyConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.json(cfg);
  }),
);

router.put(
  '/config/loyalty',
  requireRole('ADMIN'),
  validateBody(
    z.object({
      pointsPerCurrency: z.number().positive(),
      currencyPerPoint: z.number().positive(),
      minRedeemPoints: z.number().int().nonnegative(),
      maxRedeemPercent: z.number().min(0).max(100),
    }),
  ),
  asyncHandler(async (req, res) => {
    const cfg = await prisma.loyaltyConfig.update({ where: { id: 1 }, data: req.body });
    res.json(cfg);
  }),
);

export default router;
