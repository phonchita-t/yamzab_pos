// Display labels are Thai (primary language). `key` values are the domain
// codes stored in the database / sent to the API and must stay untranslated.

export const SPICE_LEVELS = [
  { key: 'NONE', label: 'ไม่เผ็ด', en: 'Not spicy', th: 'ไม่เผ็ด', peppers: 0, color: '#94a3b8' },
  { key: 'MILD', label: 'เผ็ดน้อย', en: 'Mild', th: 'เผ็ดน้อย', peppers: 1, color: '#fbbf24' },
  { key: 'MEDIUM', label: 'เผ็ดปานกลาง', en: 'Medium', th: 'เผ็ดปานกลาง', peppers: 2, color: '#fb923c' },
  { key: 'HOT', label: 'เผ็ด', en: 'Hot', th: 'เผ็ด', peppers: 3, color: '#f97316' },
  { key: 'THAI_HOT', label: 'เผ็ดมาก', en: 'Thai hot', th: 'เผ็ดมาก', peppers: 4, color: '#ea580c' },
  { key: 'EXTRA_THAI_HOT', label: 'เผ็ดสะใจ', en: 'Extra Thai hot', th: 'เผ็ดสะใจ', peppers: 5, color: '#dc2626' },
];

export const spiceMeta = (key) => SPICE_LEVELS.find((s) => s.key === key) || SPICE_LEVELS[2];

export const PAYMENT_METHODS = [
  { key: 'CASH', label: 'เงินสด', en: 'Cash', th: 'เงินสด', icon: '💵' },
  { key: 'QR_PROMPTPAY', label: 'พร้อมเพย์', en: 'QR PromptPay', th: 'พร้อมเพย์', icon: '📱' },
  { key: 'CREDIT_CARD', label: 'บัตรเครดิต', en: 'Credit Card', th: 'บัตรเครดิต', icon: '💳' },
];

export const paymentLabel = (key) =>
  PAYMENT_METHODS.find((m) => m.key === key)?.label || key;

// Inventory stock-movement types
export const MOVEMENT_TYPES = {
  PURCHASE: 'รับเข้า',
  WASTE: 'ของเสีย',
  ADJUSTMENT: 'ปรับยอด',
  SALE: 'ขายออก',
};

export const movementTypeLabel = (key) => MOVEMENT_TYPES[key] || key;

// Loyalty ledger transaction types
export const LOYALTY_TYPES = {
  EARN: 'สะสมแต้ม',
  REDEEM: 'ใช้แต้ม',
  ADJUST: 'ปรับแต้ม',
  ADJUSTMENT: 'ปรับแต้ม',
  EXPIRE: 'แต้มหมดอายุ',
};

export const loyaltyTypeLabel = (key) => LOYALTY_TYPES[key] || key;

// Order types
export const ORDER_TYPES = {
  DINE_IN: 'ทานที่ร้าน',
  TAKEAWAY: 'กลับบ้าน',
  DELIVERY: 'เดลิเวอรี',
};

export const orderTypeLabel = (key) => ORDER_TYPES[key] || key;

// Staff roles
export const ROLE_LABELS = {
  ADMIN: 'ผู้ดูแลระบบ',
  CASHIER: 'แคชเชียร์',
};

export const roleLabel = (key) => ROLE_LABELS[key] || key;
