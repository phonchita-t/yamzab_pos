import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { relativeMinutes } from '../lib/format.js';
import { spiceMeta, orderTypeLabel } from '../lib/constants.js';

const COLUMNS = [
  { status: 'PENDING', title: 'รอดำเนินการ', accent: 'border-amber-400' },
  { status: 'PREPARING', title: 'กำลังปรุง', accent: 'border-sky-400' },
  { status: 'COMPLETED', title: 'เสร็จสิ้น', accent: 'border-lime-400' },
];

const NEXT = { PENDING: 'PREPARING', PREPARING: 'COMPLETED' };

export default function KDSPage() {
  const [orders, setOrders] = useState([]);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    api
      .get('/orders/kds', { status: 'PENDING,PREPARING,COMPLETED' })
      .then(setOrders)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // near-real-time refresh
    const clock = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const advance = async (order) => {
    const next = NEXT[order.status];
    if (!next) return;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    await api.patch(`/orders/${order.id}/status`, { status: next }).catch(load);
  };

  return (
    <div className="flex h-full flex-col bg-charcoal text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="text-xl">🍳</span>
        <h1 className="text-lg font-extrabold">จอแสดงผลครัว · KDS</h1>
        <span className="ml-2 text-xs text-white/40">รีเฟรชอัตโนมัติทุก 5 วินาที{tick >= 0 && ''}</span>
        <Link to="/pos" className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
          ← กลับหน้าขาย
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders
            .filter((o) => o.status === col.status)
            .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));
          return (
            <div key={col.status} className="flex min-h-0 flex-col rounded-2xl bg-white/5">
              <div className="flex items-center justify-between px-4 py-2.5">
                <h2 className="font-bold">{col.title}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{list.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
                {list.map((o) => (
                  <article key={o.id} className={`rounded-xl border-l-4 bg-white p-3 text-charcoal ${col.accent}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-extrabold">#{o.orderNumber}</span>
                      <span className="text-xs text-stone-400">{relativeMinutes(o.placedAt)}</span>
                    </div>
                    <p className="text-xs text-stone-500">
                      {orderTypeLabel(o.orderType)}
                      {o.tableLabel ? ` · โต๊ะ ${o.tableLabel}` : ''}
                      {o.customer?.fullName ? ` · ${o.customer.fullName}` : ''}
                    </p>

                    <ul className="mt-2 space-y-1.5">
                      {o.items.map((it) => {
                        const sm = spiceMeta(it.spiceLevel);
                        return (
                          <li key={it.id} className="rounded-lg bg-stone-50 px-2 py-1.5 text-sm">
                            <div className="flex justify-between font-semibold">
                              <span>
                                {it.quantity}× {it.nameSnapshot}
                              </span>
                              {it.spiceLevel !== 'NONE' && (
                                <span title={sm.label}>{'🌶️'.repeat(sm.peppers)}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 text-xs text-stone-500">
                              {it.plaRa && (
                                <span className="rounded bg-fishsauce/15 px-1.5 font-semibold text-fishsauce">
                                  + ปลาร้า
                                </span>
                              )}
                              {it.options?.map((op) => (
                                <span key={op.id} className="rounded bg-stone-200 px-1.5">
                                  {op.nameSnapshot}
                                </span>
                              ))}
                              {it.note && <span className="italic text-chilli-600">“{it.note}”</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {o.note && <p className="mt-2 text-xs italic text-stone-500">หมายเหตุออเดอร์: {o.note}</p>}

                    {NEXT[o.status] && (
                      <button
                        onClick={() => advance(o)}
                        className="btn-primary mt-3 w-full !py-1.5 text-sm"
                      >
                        {o.status === 'PENDING' ? 'เริ่มปรุง →' : 'ปรุงเสร็จแล้ว ✓'}
                      </button>
                    )}
                  </article>
                ))}
                {list.length === 0 && <p className="px-2 py-6 text-center text-sm text-white/30">ไม่มีออเดอร์</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
