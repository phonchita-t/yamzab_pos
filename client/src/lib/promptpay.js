import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

/**
 * Direct PromptPay QR configuration.
 *
 * VITE_PROMPTPAY_ID  — the shop's receiving account: a Thai mobile number
 *                      (10 digits) or a 13-digit National ID / Tax ID.
 * VITE_MERCHANT_NAME — display name shown above the QR.
 */
export const PROMPTPAY_ID = (import.meta.env.VITE_PROMPTPAY_ID || '').replace(/[^0-9]/g, '');
export const MERCHANT_NAME = import.meta.env.VITE_MERCHANT_NAME || 'ร้าน ยำแซ่บ';
export const promptPayConfigured = PROMPTPAY_ID.length === 10 || PROMPTPAY_ID.length === 13;

/**
 * EMVCo-compliant *dynamic* PromptPay payload with the exact amount baked in.
 * Returns '' when the shop account is not configured.
 */
export function buildPromptPayPayload(amount) {
  if (!promptPayConfigured) return '';
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  return generatePayload(PROMPTPAY_ID, { amount: value });
}

/** Render a PromptPay payload string to a crisp SVG markup string. */
export function payloadToSvg(payload) {
  return QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
  });
}

/**
 * Human-readable, partially masked account identifier.
 *   0812345678      -> 08x-xxx-x678
 *   1234567890123   -> x-xxxx-xxxxx-x23
 */
export function maskPromptPayId(id = PROMPTPAY_ID) {
  const digits = String(id).replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 2)}x-xxx-x${digits.slice(-3)}`;
  }
  if (digits.length === 13) {
    return `x-xxxx-xxxxx-x${digits.slice(-2)}`;
  }
  if (digits.length > 4) {
    return `${'x'.repeat(digits.length - 4)}${digits.slice(-4)}`;
  }
  return digits || '—';
}
