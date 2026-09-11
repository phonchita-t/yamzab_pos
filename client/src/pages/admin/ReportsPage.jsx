import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';

const GROUPS = [
  { key: 'day', label: 'รายวัน' },
  { key: 'week', label: 'รายสัปดาห์' },
  { key: 'month', label: 'รายเดือน' },
];

export default function ReportsPage() {
  const [groupBy, setGroupBy] = useState('day');
  const [rows, setRows] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);

  useEffect(() => {
    api.get('/reports/sales', { groupBy, period: 'month' }).then(setRows);
  }, [groupBy]);

  useEffect(() => {
    api.get('/reports/dashboard', { period: 'month' }).then((d) => setBestSellers(d.bestSellers));
  }, []);

  const fmtBucket = (b) => {
    const d = new Date(b);
    if (groupBy === 'month') return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    if (groupBy === 'week') return `สัปดาห์ที่เริ่ม ${d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}`;
    return d.toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const totals = rows.reduce(
    (acc, r) => ({
      orders: acc.orders + (r.orders || 0),
      gross: acc.gross + (r.gross_sales || 0),
      discounts: acc.discounts + (r.discounts || 0),
    }),
    { orders: 0, gross: 0, discounts: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">รายงานยอดขาย</h1>
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGroupBy(g.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                groupBy === g.key ? 'bg-charcoal text-white' : 'text-stone-500'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="ออเดอร์ทั้งหมด (30 วัน)" value={totals.orders} />
        <Kpi label="ยอดขายรวม (30 วัน)" value={money(totals.gross)} />
        <Kpi label="ส่วนลด (30 วัน)" value={money(totals.discounts)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">ช่วงเวลา</th>
              <th className="px-4 py-2.5 text-right">ออเดอร์</th>
              <th className="px-4 py-2.5 text-right">ยอดขายรวม</th>
              <th className="px-4 py-2.5 text-right">ส่วนลด</th>
              <th className="px-4 py-2.5 text-right">เฉลี่ย/ออเดอร์</th>
              <th className="px-4 py-2.5 text-right">แต้มที่แจก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.bucket}>
                <td className="px-4 py-2.5 font-semibold">{fmtBucket(r.bucket)}</td>
                <td className="px-4 py-2.5 text-right">{r.orders}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{money(r.gross_sales)}</td>
                <td className="px-4 py-2.5 text-right text-chilli-600">{money(r.discounts)}</td>
                <td className="px-4 py-2.5 text-right">
                  {money(r.orders ? r.gross_sales / r.orders : 0)}
                </td>
                <td className="px-4 py-2.5 text-right">{r.points_issued}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                  ไม่มียอดขายที่เสร็จสมบูรณ์ในช่วงนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-bold">เมนูขายดี (30 วัน)</h2>
        <ol className="space-y-2">
          {bestSellers.map((b, i) => (
            <li key={b.productId} className="flex items-center gap-3 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-chilli-100 text-xs font-bold text-chilli-700">
                {i + 1}
              </span>
              <span className="flex-1 font-semibold">{b.nameTh || b.name}</span>
              <span className="text-stone-500">ขายได้ {b.qty}</span>
              <span className="w-24 text-right font-semibold">{money(b.revenue)}</span>
            </li>
          ))}
          {bestSellers.length === 0 && <li className="text-stone-400">ยังไม่มีข้อมูล</li>}
        </ol>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
