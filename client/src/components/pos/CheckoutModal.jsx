import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal.jsx';
import { api } from '../../lib/api.js';
import { useCart } from '../../context/CartContext.jsx';
import { money } from '../../lib/format.js';
import { PAYMENT_METHODS } from '../../lib/constants.js';
import MemberPanel from './MemberPanel.jsx';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function CheckoutModal({ onClose }) {
  const cart = useCart();
  const [config, setConfig] = useState(null);
  const [customer, setCustomer] = useState(null);

  const [manualDiscount, setManualDiscount] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [payments, setPayments] = useState([{ method: 'CASH', amount: 0, tendered: '' }]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/customers/config/loyalty').then(setConfig).catch(() => {});
  }, []);

  /* ----- bill preview (mirrors server buildBill) ----- */
  const bill = useMemo(() => {
    const subtotal = round2(cart.subtotal);
    const tierPct = customer?.tier ? Number(customer.tier.discountPercent) : 0;
    const tierDiscount = round2((subtotal * tierPct) / 100);
    const discountAmount = round2(Math.min(Number(manualDiscount || 0) + tierDiscount, subtotal));
    const afterDiscount = round2(subtotal - discountAmount);

    let redeemed = 0;
    let pointsValue = 0;
    if (customer && config) {
      const cpp = Number(config.currencyPerPoint);
      const maxVal = round2((afterDiscount * Number(config.maxRedeemPercent)) / 100);
      redeemed = Math.min(Number(pointsToRedeem || 0), customer.pointsBalance);
      if (redeemed < Number(config.minRedeemPoints)) redeemed = 0;
      pointsValue = Math.min(round2(redeemed * cpp), maxVal);
      redeemed = Math.floor(pointsValue / cpp);
      pointsValue = round2(redeemed * cpp);
    }
    const total = round2(afterDiscount - pointsValue);
    const mult = customer?.tier ? Number(customer.tier.pointsMultiplier) : 1;
    const earned = config ? Math.floor(total * Number(config.pointsPerCurrency) * mult) : 0;
    return { subtotal, tierDiscount, discountAmount, redeemed, pointsValue, total, earned };
  }, [cart.subtotal, customer, config, manualDiscount, pointsToRedeem]);

  const paid = round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  const remaining = round2(bill.total - paid);
  const changeDue = round2(Math.max(0, paid - bill.total));

  const setPayment = (i, patch) =>
    setPayments((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const fillRemaining = (i) => setPayment(i, { amount: Math.max(0, remaining + Number(payments[i].amount || 0)) });

  const confirm = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/orders/checkout', {
        items: cart.toCheckoutItems(),
        customerId: customer?.id ?? null,
        manualDiscount: Number(manualDiscount || 0),
        pointsToRedeem: bill.redeemed,
        payments: payments
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: Number(p.amount),
            tendered: p.method === 'CASH' && p.tendered ? Number(p.tendered) : undefined,
            reference: p.reference || undefined,
          })),
      });
      setResult(res);
      cart.clear();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- receipt screen ---------------- */
  if (result) {
    const o = result.order;
    return (
      <Modal open onClose={onClose} title={`Order #${o.orderNumber} paid ✅`} size="sm">
        <div className="space-y-3 p-6 text-center">
          <p className="text-5xl">🌶️</p>
          <p className="text-2xl font-extrabold">{money(o.total)}</p>
          {changeDue > 0 && <p className="text-lg font-semibold text-lime-600">Change: {money(changeDue)}</p>}
          {o.pointsEarned > 0 && (
            <p className="text-sm text-stone-500">+{o.pointsEarned} loyalty points earned</p>
          )}
          <p className="text-xs text-stone-400">Sent to kitchen display · status Pending</p>
          <button className="btn-primary w-full" onClick={onClose}>New order</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Checkout" size="lg">
      <div className="grid gap-5 p-5 md:grid-cols-2">
        {/* left: member + discounts */}
        <div className="space-y-4">
          <MemberPanel customer={customer} onSelect={setCustomer} config={config} />

          <section className="card p-4">
            <p className="label">Manual discount (฿)</p>
            <input
              type="number"
              min="0"
              className="input"
              value={manualDiscount}
              onChange={(e) => setManualDiscount(e.target.value)}
            />
          </section>

          {customer && config && customer.pointsBalance >= config.minRedeemPoints && (
            <section className="card p-4">
              <p className="label">
                Redeem points (balance {customer.pointsBalance} · {money(config.currencyPerPoint)}/pt)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="10"
                  max={customer.pointsBalance}
                  className="input"
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(e.target.value)}
                />
                <button
                  className="btn-ghost shrink-0"
                  onClick={() => setPointsToRedeem(customer.pointsBalance)}
                >
                  Max
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Min {config.minRedeemPoints} pts · capped at {config.maxRedeemPercent}% of the bill
              </p>
            </section>
          )}
        </div>

        {/* right: bill + payment */}
        <div className="space-y-4">
          <section className="card space-y-1.5 p-4 text-sm">
            <Row label="Subtotal" value={money(bill.subtotal)} />
            {bill.tierDiscount > 0 && (
              <Row label={`${customer.tier.name} discount`} value={`− ${money(bill.tierDiscount)}`} accent />
            )}
            {Number(manualDiscount) > 0 && <Row label="Manual discount" value={`− ${money(manualDiscount)}`} accent />}
            {bill.pointsValue > 0 && (
              <Row label={`Points redeemed (${bill.redeemed})`} value={`− ${money(bill.pointsValue)}`} accent />
            )}
            <div className="my-1 border-t border-dashed border-stone-200" />
            <Row label="Total due" value={money(bill.total)} big />
            {bill.earned > 0 && (
              <p className="pt-1 text-xs text-lime-600">Member will earn +{bill.earned} points</p>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <p className="label">Payment</p>
            {payments.map((p, i) => (
              <div key={i} className="rounded-xl border border-stone-200 p-3">
                <div className="mb-2 flex gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setPayment(i, { method: m.key })}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                        p.method === m.key ? 'bg-charcoal text-white' : 'bg-stone-100'
                      }`}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={(e) => setPayment(i, { amount: e.target.value })}
                  />
                  <button className="btn-ghost shrink-0" onClick={() => fillRemaining(i)}>
                    Exact
                  </button>
                </div>
                {p.method === 'CASH' && (
                  <input
                    type="number"
                    className="input mt-2"
                    placeholder="Cash tendered (for change)"
                    value={p.tendered}
                    onChange={(e) => setPayment(i, { tendered: e.target.value })}
                  />
                )}
                {p.method !== 'CASH' && (
                  <input
                    className="input mt-2"
                    placeholder="Reference / approval code (optional)"
                    value={p.reference || ''}
                    onChange={(e) => setPayment(i, { reference: e.target.value })}
                  />
                )}
              </div>
            ))}
            <button
              className="text-xs font-semibold text-chilli-600 hover:underline"
              onClick={() => setPayments((p) => [...p, { method: 'QR_PROMPTPAY', amount: Math.max(0, remaining), tendered: '' }])}
            >
              + Split payment
            </button>

            <div className="flex justify-between border-t border-stone-200 pt-2 text-sm">
              <span className={remaining > 0.01 ? 'font-semibold text-chilli-600' : 'text-stone-500'}>
                {remaining > 0.01 ? `Remaining ${money(remaining)}` : `Change ${money(changeDue)}`}
              </span>
              <span className="font-semibold">Paid {money(paid)}</span>
            </div>
          </section>

          {error && <p className="rounded-lg bg-chilli-50 px-3 py-2 text-sm text-chilli-700">{error}</p>}

          <button
            className="btn-primary w-full text-base"
            disabled={busy || cart.lines.length === 0 || remaining > 0.01}
            onClick={confirm}
          >
            {busy ? 'Processing…' : `Complete payment · ${money(bill.total)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, accent, big }) {
  return (
    <div className={`flex justify-between ${big ? 'text-lg font-extrabold' : ''}`}>
      <span className={accent ? 'text-chilli-600' : 'text-stone-500'}>{label}</span>
      <span className={accent ? 'text-chilli-600' : ''}>{value}</span>
    </div>
  );
}
