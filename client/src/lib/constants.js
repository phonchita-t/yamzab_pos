export const SPICE_LEVELS = [
  { key: 'NONE', label: 'Not spicy', th: 'ไม่เผ็ด', peppers: 0, color: '#94a3b8' },
  { key: 'MILD', label: 'Mild', th: 'เผ็ดน้อย', peppers: 1, color: '#fbbf24' },
  { key: 'MEDIUM', label: 'Medium', th: 'เผ็ดปานกลาง', peppers: 2, color: '#fb923c' },
  { key: 'HOT', label: 'Hot', th: 'เผ็ด', peppers: 3, color: '#f97316' },
  { key: 'THAI_HOT', label: 'Thai hot', th: 'เผ็ดมาก', peppers: 4, color: '#ea580c' },
  { key: 'EXTRA_THAI_HOT', label: 'Extra Thai hot', th: 'เผ็ดสะใจ', peppers: 5, color: '#dc2626' },
];

export const spiceMeta = (key) => SPICE_LEVELS.find((s) => s.key === key) || SPICE_LEVELS[2];

export const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', th: 'เงินสด', icon: '💵' },
  { key: 'QR_PROMPTPAY', label: 'QR PromptPay', th: 'พร้อมเพย์', icon: '📱' },
  { key: 'CREDIT_CARD', label: 'Credit Card', th: 'บัตรเครดิต', icon: '💳' },
];

export const ORDER_STATUS = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-800 ring-amber-200' },
  PREPARING: { label: 'Preparing', color: 'bg-sky-100 text-sky-800 ring-sky-200' },
  COMPLETED: { label: 'Completed', color: 'bg-lime-100 text-lime-800 ring-lime-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-stone-200 text-stone-600 ring-stone-300' },
};
