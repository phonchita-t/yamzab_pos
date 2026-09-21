import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal.jsx';
import { db } from '../../lib/store.js';
import { round2, buildBill } from '../../lib/pricing.js';
import { useCart } from '../../context/CartContext.jsx';
import { money } from '../../lib/format.js';
import { PAYMENT_METHODS, paymentLabel } from '../../lib/constants.js';
import MemberPanel from './MemberPanel.jsx';
import PromptPayQR from './PromptPayQR.jsx';

// Common Thai banknotes for the quick-cash shortcuts.
const CASH_QUICK = [100, 500, 1000];

export default function CheckoutModal({ onClose }) {
  const cart = useCart();
  const [config, setConfig] = useState(null);
  const [customer, setCustomer] = useState(null);

  const [manualDiscount, setManualDiscount] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Single-tender state (the common path).
  const [method, setMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');

  // Split-tender state — only used once the cashier opts in.
  const [splitMode, setSplitMode] = useState(false);
  const [payments, setPayments] = useState([{ method: 'CASH', amount: '', tendered: '' }]);

  const [result, setResult] = useState(null);
  const [lastChange, setLastChange] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConfig(db.getLoyaltyConfig());
  }, []);

  /* ----- bill preview — same buildBill() the checkout commit uses ----- */
  const bill = useMemo(() => {
    if (!config) {
      const subtotal = round2(cart.subtotal);
      return { subtotal, tierDiscount: 0, discountAmount: 0, pointsRedeemed: 0, pointsValue: 0, total: subtotal, pointsEarned: 0 };
    }
    const items = cart.lines.map((l) => ({
      unitPrice: Number(l.product.price),
      optionsTotal: round2(l.options.reduce((s, o) => s + Number(o.priceDelta), 0)),
      quantity: l.quantity,
    }));
    const clampedRedeem = customer ? Math.min(Number(pointsToRedeem || 0), customer.pointsBalance) : 0;
    return buildBill(items, {
      manualDiscount: Number(manualDiscount || 0),
      tierDiscountPct: customer?.tier ? Number(customer.tier.discountPercent) : 0,
      pointsToRedeem: clampedRedeem,
      loyaltyConfig: config,
      pointsMultiplier: customer?.tier ? Number(customer.tier.pointsMultiplier) : 1,
    });
  }, [cart.lines, cart.subtotal, customer, config, manualDiscount, pointsToRedeem]);

  /* ----- single-tender maths ----- */
  const cashNum = round2(Number(cashReceived || 0));
  const singleChange = round2(Math.max(0, cashNum - bill.total));
  const singleShort = round2(Math.max(0, bill.total - cashNum));
  const singleOk = method !== 'CASH' || cashNum + 0.001 >= bill.total;

  /* ----- split-tender maths ----- */
  const paid = round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  const remaining = round2(bill.total - paid);
  const splitChange = round2(Math.max(0, paid - bill.total));

  const setPayment = (i, patch) =>
    setPayments((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const fillRemaining = (i) =>
    setPayment(i, { amount: round2(Math.max(0, remaining + Number(payments[i].amount || 0))) });

  const enterSplit = () => {
    setPayments([
      { method: 'CASH', amount: '', tendered: '' },
      { method: 'QR_PROMPTPAY', amount: String(bill.total), tendered: '' },
    ]);
    setSplitMode(true);
  };
  const exitSplit = () => setSplitMode(false);

  const effectiveChange = splitMode ? splitChange : singleChange;
  const canConfirm =
    !busy &&
    cart.lines.length > 0 &&
    bill.total > 0 &&
    (splitMode ? remaining <= 0.01 : singleOk);

  const confirm = () => {
    setError('');
    setBusy(true);
    try {
      const outgoing = splitMode
        ? payments
            .filter((p) => Number(p.amount) > 0)
            .map((p) => ({
              method: p.method,
              amount: Number(p.amount),
              tendered: p.method === 'CASH' && p.tendered ? Number(p.tendered) : undefined,
              reference: p.reference || undefined,
            }))
        : [
            {
              method,
              amount: bill.total,
              tendered: method === 'CASH' ? cashNum : undefined,
              reference: method !== 'CASH' ? reference || undefined : undefined,
            },
          ];

      const res = db.checkout({
        items: cart.toCheckoutItems(),
        customerId: customer?.id ?? null,
        manualDiscount: Number(manualDiscount || 0),
        pointsToRedeem: bill.pointsRedeemed,
        payments: outgoing,
      });
      setLastChange(effectiveChange);
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
      <Modal open onClose={onClose} title={`ออเดอร์ #${o.orderNumber} ชำระเงินแล้ว ✅`} size="sm">
        <div className="space-y-3 p-6 text-center">
          <p className="text-5xl">🌶️</p>
          <p className="text-2xl font-extrabold">{money(o.total)}</p>
          {lastChange > 0 && (
            <div className="mx-auto rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">เงินทอน</p>
              <p className="text-2xl font-extrabold text-emerald-800">{money(lastChange)}</p>
            </div>
          )}
          {o.pointsEarned > 0 && (
            <p className="text-sm text-stone-500">ได้รับแต้มสะสม +{o.pointsEarned} แต้ม</p>
          )}
          <p className="text-xs text-stone-400">บันทึกการขายเรียบร้อยแล้ว</p>
          <button className="btn-primary w-full" onClick={onClose}>ออเดอร์ใหม่</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="ชำระเงิน" size="lg">
      <div className="grid gap-5 p-5 md:grid-cols-2">
        {/* left: member + discounts */}
        <div className="space-y-4">
          <MemberPanel customer={customer} onSelect={setCustomer} config={config} />

          <section className="card p-4">
            <p className="label">ส่วนลดกำหนดเอง (฿)</p>
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
                ใช้แต้มสะสม (คงเหลือ {customer.pointsBalance} · {money(config.currencyPerPoint)}/แต้ม)
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
                  สูงสุด
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                ขั้นต่ำ {config.minRedeemPoints} แต้ม · ใช้ได้ไม่เกิน {config.maxRedeemPercent}% ของยอดบิล
              </p>
            </section>
          )}
        </div>

        {/* right: bill + payment */}
        <div className="space-y-4">
          <section className="card space-y-1.5 p-4 text-sm">
            <Row label="ยอดรวม" value={money(bill.subtotal)} />
            {bill.tierDiscount > 0 && (
              <Row label={`ส่วนลดระดับ ${customer.tier.name}`} value={`− ${money(bill.tierDiscount)}`} accent />
            )}
            {Number(manualDiscount) > 0 && <Row label="ส่วนลดกำหนดเอง" value={`− ${money(manualDiscount)}`} accent />}
            {bill.pointsValue > 0 && (
              <Row label={`ใช้แต้มสะสม (${bill.pointsRedeemed} แต้ม)`} value={`− ${money(bill.pointsValue)}`} accent />
            )}
            <div className="my-1 border-t border-dashed border-stone-200" />
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-charcoal">ยอดรวมทั้งสิ้น</span>
              <span className="text-2xl font-extrabold tabular-nums text-charcoal">{money(bill.total)}</span>
            </div>
            {bill.pointsEarned > 0 && (
              <p className="pt-1 text-xs text-lime-600">สมาชิกจะได้รับแต้มสะสม +{bill.pointsEarned} แต้ม</p>
            )}
          </section>

          {splitMode ? (
            <SplitPayments
              payments={payments}
              setPayment={setPayment}
              setPayments={setPayments}
              fillRemaining={fillRemaining}
              remaining={remaining}
              paid={paid}
              splitChange={splitChange}
              billTotal={bill.total}
              onExit={exitSplit}
            />
          ) : method === 'QR_PROMPTPAY' ? (
            <PromptPayQR
              amount={bill.total}
              reference={reference}
              onReference={setReference}
              onCancel={() => {
                setMethod('CASH');
                setError('');
              }}
              onConfirm={confirm}
              busy={busy}
              disabled={cart.lines.length === 0 || bill.total <= 0}
            />
          ) : (
            <section className="card space-y-3 p-4">
              <p className="label">ช่องทางการชำระเงิน</p>
              <div className="flex gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                      method === m.key ? 'bg-charcoal text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {method === 'CASH' ? (
                <>
                  <div>
                    <label className="label">รับเงินมา (฿)</label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      autoFocus
                      className="input text-right text-2xl font-extrabold tabular-nums"
                      placeholder={String(bill.total)}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <button
                        className="rounded-xl border-2 border-chilli-200 bg-chilli-50 py-2 text-sm font-bold text-chilli-700 hover:border-chilli-400"
                        onClick={() => setCashReceived(String(bill.total))}
                      >
                        พอดี
                      </button>
                      {CASH_QUICK.map((v) => (
                        <button
                          key={v}
                          className="rounded-xl border-2 border-stone-200 py-2 text-sm font-bold text-stone-700 hover:border-chilli-400 hover:bg-chilli-50"
                          onClick={() => setCashReceived(String(v))}
                        >
                          {money(v)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {singleShort > 0.01 ? (
                    <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                      <span className="text-sm font-bold text-amber-800">ยังขาดอีก</span>
                      <span className="text-xl font-extrabold tabular-nums text-amber-900">
                        {money(singleShort)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-300">
                      <span className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                        เงินทอน
                      </span>
                      <span className="text-3xl font-extrabold tabular-nums text-emerald-800">
                        {money(singleChange)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
                    <span className="text-sm font-semibold text-stone-500">
                      ยอดเรียกเก็บ · {paymentLabel(method)}
                    </span>
                    <span className="text-xl font-extrabold tabular-nums">{money(bill.total)}</span>
                  </div>
                  <input
                    className="input"
                    placeholder="เลขอ้างอิง / รหัสอนุมัติ (ไม่บังคับ)"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </>
              )}

              <button
                className="text-xs font-semibold text-chilli-600 hover:underline"
                onClick={enterSplit}
              >
                + แยกชำระหลายช่องทาง
              </button>
            </section>
          )}

          {error && <p className="rounded-lg bg-chilli-50 px-3 py-2 text-sm text-chilli-700">{error}</p>}

          {(splitMode || method !== 'QR_PROMPTPAY') && (
            <button
              className="btn-primary w-full text-base"
              disabled={!canConfirm}
              onClick={confirm}
            >
              {busy
                ? 'กำลังดำเนินการ…'
                : effectiveChange > 0.01
                  ? `ยืนยันการชำระเงิน (เงินทอน ${money(effectiveChange)})`
                  : 'ยืนยันการชำระเงิน'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* -------------------- split-tender sub-panel -------------------- */
function SplitPayments({
  payments,
  setPayment,
  setPayments,
  fillRemaining,
  remaining,
  paid,
  splitChange,
  billTotal,
  onExit,
}) {
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="label mb-0">แยกชำระหลายช่องทาง</p>
        <button className="text-xs font-semibold text-stone-400 hover:text-chilli-600" onClick={onExit}>
          ← กลับสู่การชำระแบบเดียว
        </button>
      </div>

      {payments.map((p, i) => (
        <div key={i} className="rounded-xl border border-stone-200 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="flex flex-1 gap-1.5">
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
            {payments.length > 1 && (
              <button
                onClick={() => setPayments((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-stone-400 hover:text-chilli-600"
                aria-label="ลบรายการชำระ"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="input"
              placeholder="จำนวนที่ตัดจากบิล"
              value={p.amount}
              onChange={(e) => setPayment(i, { amount: e.target.value })}
            />
            <button className="btn-ghost shrink-0" onClick={() => fillRemaining(i)}>
              ยอดคงเหลือ
            </button>
          </div>
          {p.method === 'CASH' && (
            <input
              type="number"
              className="input mt-2"
              placeholder="รับเงินสดมา (สำหรับทอน)"
              value={p.tendered}
              onChange={(e) => setPayment(i, { tendered: e.target.value })}
            />
          )}
          {p.method !== 'CASH' && (
            <input
              className="input mt-2"
              placeholder="เลขอ้างอิง / รหัสอนุมัติ (ไม่บังคับ)"
              value={p.reference || ''}
              onChange={(e) => setPayment(i, { reference: e.target.value })}
            />
          )}
        </div>
      ))}

      <button
        className="text-xs font-semibold text-chilli-600 hover:underline"
        onClick={() =>
          setPayments((prev) => [
            ...prev,
            { method: 'QR_PROMPTPAY', amount: String(Math.max(0, remaining)), tendered: '' },
          ])
        }
      >
        + เพิ่มช่องทางชำระ
      </button>

      <div className="space-y-1 border-t border-stone-200 pt-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">ยอดที่ต้องชำระ</span>
          <span className="font-semibold tabular-nums">{money(billTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">ชำระแล้ว</span>
          <span className="font-semibold tabular-nums">{money(paid)}</span>
        </div>
        {remaining > 0.01 ? (
          <div className="flex justify-between font-bold text-chilli-600">
            <span>ค้างชำระ</span>
            <span className="tabular-nums">{money(remaining)}</span>
          </div>
        ) : (
          <div className="flex justify-between font-bold text-emerald-700">
            <span>เงินทอน</span>
            <span className="tabular-nums">{money(splitChange)}</span>
          </div>
        )}
      </div>
    </section>
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
