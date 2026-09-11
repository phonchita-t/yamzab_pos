import { useEffect, useState } from 'react';
import { money } from '../../lib/format.js';
import {
  MERCHANT_NAME,
  promptPayConfigured,
  buildPromptPayPayload,
  payloadToSvg,
  maskPromptPayId,
} from '../../lib/promptpay.js';

/**
 * Direct dynamic PromptPay QR card shown inside the checkout when the cashier
 * picks "พร้อมเพย์". No payment gateway — the cashier verifies the incoming
 * transfer in their bank app and taps "ยืนยันได้รับเงินแล้ว".
 */
export default function PromptPayQR({
  amount,
  reference,
  onReference,
  onCancel,
  onConfirm,
  busy,
  disabled,
}) {
  const [svg, setSvg] = useState('');
  const [genError, setGenError] = useState('');

  useEffect(() => {
    let alive = true;
    const payload = buildPromptPayPayload(amount);
    if (!payload) {
      setSvg('');
      return undefined;
    }
    payloadToSvg(payload)
      .then((markup) => {
        if (alive) {
          setSvg(markup);
          setGenError('');
        }
      })
      .catch((err) => {
        if (alive) setGenError(err.message || 'สร้าง QR ไม่สำเร็จ');
      });
    return () => {
      alive = false;
    };
  }, [amount]);

  return (
    <section className="card overflow-hidden">
      {/* PromptPay brand banner — replace with the official asset if available */}
      <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#001e4c] via-[#0b3aa8] to-[#123fd6] px-4 py-2.5 text-white">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-white text-sm font-black text-[#0b3aa8]">
          ฿
        </span>
        <span className="text-base font-extrabold tracking-wide">PromptPay</span>
        <span className="text-sm font-semibold text-white/80">พร้อมเพย์</span>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex justify-center">
          <div className="rounded-2xl border border-stone-200 bg-white p-3">
            {svg ? (
              <div
                className="h-[250px] w-[250px] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="grid h-[250px] w-[250px] place-items-center rounded-xl bg-stone-50 px-6 text-center text-sm text-stone-400">
                {promptPayConfigured
                  ? genError || 'กำลังสร้าง QR…'
                  : 'ยังไม่ได้ตั้งค่าบัญชีพร้อมเพย์ (VITE_PROMPTPAY_ID) — ให้ลูกค้าสแกนจากป้าย QR ของร้าน แล้วกดยืนยันเมื่อได้รับเงิน'}
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-stone-500">ยอดชำระ</p>
          <p className="text-3xl font-extrabold tabular-nums text-charcoal">{money(amount)}</p>
        </div>

        <div className="rounded-xl bg-stone-50 px-4 py-2.5 text-center text-sm">
          <span className="font-semibold text-charcoal">{MERCHANT_NAME}</span>
          <span className="text-stone-400"> · </span>
          <span className="tabular-nums text-stone-500">{maskPromptPayId()}</span>
        </div>

        <div>
          <label className="label">เลขอ้างอิง / สลิปโอนเงิน (ไม่บังคับ)</label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="เช่น เลข 4 ตัวท้ายของรายการโอน"
            value={reference}
            onChange={(e) => onReference(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn-ghost flex-1" onClick={onCancel} disabled={busy}>
            ยกเลิก
          </button>
          <button
            className="btn-lime flex-[2] font-bold"
            onClick={onConfirm}
            disabled={busy || disabled}
          >
            {busy ? 'กำลังบันทึก…' : 'ยืนยันได้รับเงินแล้ว'}
          </button>
        </div>
        <p className="text-center text-xs text-stone-400">
          ตรวจสอบยอดเงินเข้าบัญชีร้านก่อนกดยืนยัน
        </p>
      </div>
    </section>
  );
}
