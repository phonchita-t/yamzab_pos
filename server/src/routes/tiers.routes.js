import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.membershipTier.findMany({ orderBy: { sortOrder: 'asc' } }));
  }),
);

const tierSchema = z.object({
  name: z.string().min(1),
  minPoints: z.number().int().nonnegative(),
  discountPercent: z.number().min(0).max(100),
  pointsMultiplier: z.number().positive(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(tierSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.membershipTier.create({ data: req.body }));
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(tierSchema.partial()),
  asyncHandler(async (req, res) => {
    res.json(await prisma.membershipTier.update({ where: { id: req.params.id }, data: req.body }));
  }),
);

export default router;
