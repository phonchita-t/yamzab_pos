import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validate.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

function rangeFor(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === 'week') start.setDate(now.getDate() - 6);
  else if (period === 'month') start.setDate(now.getDate() - 29);
  else start.setHours(0, 0, 0, 0); // today
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

/** Dashboard KPIs + revenue series + best sellers. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'week';
    const { start, end } = rangeFor(period);

    const paidWhere = { status: 'COMPLETED', completedAt: { gte: start, lte: end } };

    const [agg, orders, items, paymentBreakdown, lowStock, activeMembers] = await Promise.all([
      prisma.order.aggregate({
        where: paidWhere,
        _sum: { total: true, discountAmount: true, pointsValue: true, pointsEarned: true },
        _count: true,
        _avg: { total: true },
      }),
      prisma.order.findMany({
        where: paidWhere,
        select: { total: true, completedAt: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'nameSnapshot'],
        where: { order: paidWhere },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.transaction.groupBy({
        by: ['method'],
        where: { status: 'PAID', order: paidWhere },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.product.findMany({
        where: { trackInventory: true, isActive: true },
        select: { id: true, name: true, nameTh: true, stockQty: true, reorderLevel: true },
      }),
      prisma.customer.count({ where: { isActive: true } }),
    ]);

    // Bucket revenue by day
    const buckets = new Map();
    for (const o of orders) {
      const key = o.completedAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) || 0) + Number(o.total));
    }
    const series = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, revenue: Number((buckets.get(key) || 0).toFixed(2)) });
    }

    res.json({
      period,
      range: { start, end },
      kpis: {
        grossSales: Number(agg._sum.total || 0),
        orderCount: agg._count,
        avgOrderValue: Number((agg._avg.total || 0).toFixed(2)),
        discountsGiven: Number((Number(agg._sum.discountAmount || 0) + Number(agg._sum.pointsValue || 0)).toFixed(2)),
        pointsIssued: agg._sum.pointsEarned || 0,
        activeMembers,
      },
      revenueSeries: series,
      bestSellers: items.map((i) => ({
        productId: i.productId,
        name: i.nameSnapshot,
        qty: i._sum.quantity || 0,
        revenue: Number(i._sum.lineTotal || 0),
      })),
      paymentBreakdown: paymentBreakdown.map((p) => ({
        method: p.method,
        amount: Number(p._sum.amount || 0),
        count: p._count,
      })),
      lowStock: lowStock.filter((p) => Number(p.stockQty) <= Number(p.reorderLevel)),
    });
  }),
);

/** Tabular sales summary grouped by day / week / month. */
router.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const groupBy = req.query.groupBy === 'month' ? 'month' : req.query.groupBy === 'week' ? 'week' : 'day';
    const { start, end } = rangeFor(req.query.period || 'month');

    const rows = await prisma.$queryRawUnsafe(
      `SELECT date_trunc($1, completed_at) AS bucket,
              count(*)::int              AS orders,
              sum(total)::float          AS gross_sales,
              sum(discount_amount)::float AS discounts,
              sum(points_earned)::int    AS points_issued
       FROM orders
       WHERE status = 'COMPLETED' AND completed_at BETWEEN $2 AND $3
       GROUP BY 1 ORDER BY 1 DESC`,
      groupBy,
      start,
      end,
    );
    res.json(rows);
  }),
);

export default router;
