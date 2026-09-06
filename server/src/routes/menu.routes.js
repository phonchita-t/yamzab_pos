import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

/* ----------------------------- Categories ------------------------------ */

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(categories);
  }),
);

const categorySchema = z.object({
  name: z.string().min(1),
  nameTh: z.string().optional().nullable(),
  slug: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.post(
  '/categories',
  requireRole('ADMIN'),
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json(category);
  }),
);

router.patch(
  '/categories/:id',
  requireRole('ADMIN'),
  validateBody(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    res.json(category);
  }),
);

router.delete(
  '/categories/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  }),
);

/* ------------------------------ Products ------------------------------- */

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { categoryId, includeInactive } = req.query;
    const products = await prisma.product.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(includeInactive === 'true' ? {} : { isActive: true }),
      },
      include: {
        category: { select: { name: true, slug: true, color: true } },
        optionGroups: { include: { optionGroup: { include: { options: true } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(products);
  }),
);

const productSchema = z.object({
  categoryId: z.string().uuid(),
  sku: z.string().optional().nullable(),
  name: z.string().min(1),
  nameTh: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().optional(),
  imageUrl: z.string().optional().nullable(),
  allowsSpice: z.boolean().optional(),
  allowsPlaRa: z.boolean().optional(),
  allowsProtein: z.boolean().optional(),
  defaultSpice: z.enum(['NONE', 'MILD', 'MEDIUM', 'HOT', 'THAI_HOT', 'EXTRA_THAI_HOT']).optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  stockQty: z.number().optional(),
  reorderLevel: z.number().optional(),
  sortOrder: z.number().int().optional(),
});

router.post(
  '/products',
  requireRole('ADMIN'),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({ data: req.body });
    res.status(201).json(product);
  }),
);

router.patch(
  '/products/:id',
  requireRole('ADMIN'),
  validateBody(productSchema.partial()),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json(product);
  }),
);

// Quick 86 / un-86 toggle available to cashiers too.
router.patch(
  '/products/:id/availability',
  validateBody(z.object({ isAvailable: z.boolean() })),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isAvailable: req.body.isAvailable },
    });
    res.json(product);
  }),
);

router.delete(
  '/products/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  }),
);

/* --------------------------- Inventory view ---------------------------- */

router.get(
  '/inventory',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { trackInventory: true, isActive: true },
      select: {
        id: true, name: true, nameTh: true, stockQty: true, reorderLevel: true,
        category: { select: { name: true } },
      },
      orderBy: { stockQty: 'asc' },
    });
    res.json(products);
  }),
);

const stockSchema = z.object({
  type: z.enum(['PURCHASE', 'WASTE', 'ADJUSTMENT']),
  quantity: z.number(),
  note: z.string().optional(),
});

router.post(
  '/inventory/:productId/movement',
  requireRole('ADMIN'),
  validateBody(stockSchema),
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { type, quantity, note } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const delta = type === 'WASTE' ? -Math.abs(quantity) : quantity;
      const balanceAfter = Number(product.stockQty) + delta;
      await tx.product.update({ where: { id: productId }, data: { stockQty: balanceAfter } });
      return tx.stockMovement.create({
        data: {
          productId, type, quantity: delta, balanceAfter,
          note, createdById: req.user.id,
        },
      });
    });
    res.status(201).json(result);
  }),
);

export default router;
