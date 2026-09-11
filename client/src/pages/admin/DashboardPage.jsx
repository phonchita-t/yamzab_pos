import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { paymentLabel } from '../../lib/constants.js';

const PERIODS = [
  { key: 'today', label: 'วันนี้' },
  { key: 'week', label: '7 วัน' },
  { key: 'month', label: '30 วัน' },
];
const PIE_COLORS = ['#dc2626', '#0891b2', '#7c3aed'];

export default function DashboardPage() {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api.get('/reports/dashboard', { period }).then(setData).catch((e) => setError(e.message));
  }, [period]);

  if (error) return <p className="text-chilli-700">{error}</p>;
  if (!data) return <p className="text-stone-400">กำลังโหลดแดชบอร์ด…</p>;

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">แดชบอร์ด</h1>
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                period === p.key ? 'bg-charcoal text-white' : 'text-stone-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="ยอดขายรวม" value={money(kpis.grossSales)} accent />
        <Kpi label="จำนวนออเดอร์" value={kpis.orderCount} />
        <Kpi label="ยอดเฉลี่ย/ออเดอร์" value={money(kpis.avgOrderValue)} />
        <Kpi label="ส่วนลดที่ให้" value={money(kpis.discountsGiven)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-3 font-bold">รายได้</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.revenueSeries}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} />
              <YAxis fontSize={12} width={48} />
              <Tooltip formatter={(v) => money(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">สัดส่วนช่องทางชำระเงิน</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.paymentBreakdown}
                dataKey="amount"
                nameKey="method"
                innerRadius={45}
                outerRadius={75}
              >
                {data.paymentBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [money(v), paymentLabel(n)]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1 text-sm">
            {data.paymentBreakdown.map((p, i) => (
              <li key={p.method} className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % 3] }} />
                  {paymentLabel(p.method)}
                </span>
                <span className="font-semibold">{money(p.amount)}</span>
              </li>
            ))}
            {data.paymentBreakdown.length === 0 && <li className="text-stone-400">ยังไม่มียอดขาย</li>}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">เมนูขายดี</h2>
          <ResponsiveContainer width="100%" height={Math.max(160, data.bestSellers.length * 34)}>
            <BarChart data={data.bestSellers} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} fontSize={11} />
              <Tooltip formatter={(v, n) => (n === 'qty' ? `ขายได้ ${v}` : money(v))} />
              <Bar dataKey="qty" fill="#84cc16" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">แจ้งเตือนสต็อกใกล้หมด</h2>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-stone-400">สินค้าที่ติดตามทั้งหมดอยู่เหนือจุดสั่งซื้อ ✅</p>
          ) : (
            <ul className="space-y-2">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-xl bg-chilli-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-chilli-800">{p.nameTh || p.name}</span>
                  <span className="text-chilli-600">
                    เหลือ {Number(p.stockQty)} · สั่งซื้อเมื่อถึง {Number(p.reorderLevel)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-400">สมาชิกที่ใช้งาน {kpis.activeMembers} คน · แจกแต้มในช่วงนี้ {kpis.pointsIssued} แต้ม</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className={`card p-4 ${accent ? 'bg-chilli-600 text-white ring-chilli-600' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? 'text-chilli-100' : 'text-stone-400'}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
