import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

const select = {
  id: true, username: true, fullName: true, email: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select, orderBy: { createdAt: 'asc' } });
    res.json(users);
  }),
);

const createSchema = z.object({
  username: z.string().min(3),
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'CASHIER']),
});

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { password, email, ...rest } = req.body;
    const user = await prisma.user.create({
      data: {
        ...rest,
        email: email || null,
        passwordHash: await bcrypt.hash(password, 10),
      },
      select,
    });
    res.status(201).json(user);
  }),
);

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().nullish(),
  role: z.enum(['ADMIN', 'CASHIER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.body;
    const data = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select });
    res.json(user);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'ไม่สามารถปิดการใช้งานบัญชีของตนเองได้' });
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  }),
);

export default router;
