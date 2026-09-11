const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const money = (n) => baht.format(Number(n || 0));

export const dateShort = (d) =>
  new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });

export const timeShort = (d) =>
  new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

export const relativeMinutes = (d) => {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาทีที่แล้ว`;
};

// Preferred display name for menu items / categories / options — Thai first.
export const nameOf = (o) => o?.nameTh || o?.name || '';
