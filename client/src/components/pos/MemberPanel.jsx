import { useState } from 'react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';

/**
 * Phone-number member lookup + inline registration, used inside checkout.
 */
export default function MemberPanel({ customer, onSelect }) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | searching | notfound | registering
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const search = async () => {
    const q = phone.trim();
    if (!q) return;
    setError('');
    setStatus('searching');
    try {
      const found = await api.get('/customers/lookup', { phone: q });
      onSelect(found);
      setStatus('idle');
    } catch (err) {
      if (err.status === 404) {
        setStatus('notfound');
      } else {
        setError(err.message);
        setStatus('idle');
      }
    }
  };

  const register = async () => {
    setError('');
    try {
      const created = await api.post('/customers', { phone: phone.trim(), fullName: name.trim() || null });
      onSelect(created);
      setStatus('idle');
    } catch (err) {
      setError(err.message);
    }
  };

  if (customer) {
    return (
      <section className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">สมาชิก</p>
            <p className="font-bold">{customer.fullName || 'สมาชิกไม่ระบุชื่อ'}</p>
            <p className="text-sm text-stone-500">{customer.phone}</p>
          </div>
          <button
            className="text-xs font-semibold text-stone-400 hover:text-chilli-600"
            onClick={() => onSelect(null)}
          >
            นำออก
          </button>
        </div>
        <div className="mt-3 flex gap-2 text-center text-xs">
          <div className="flex-1 rounded-lg bg-stone-100 py-2">
            <p className="font-bold text-charcoal">{customer.pointsBalance}</p>
            <p className="text-stone-500">แต้มสะสม</p>
          </div>
          <div className="flex-1 rounded-lg bg-stone-100 py-2">
            <p className="font-bold" style={{ color: customer.tier?.color }}>
              {customer.tier?.name || 'Member'}
            </p>
            <p className="text-stone-500">
              {customer.tier?.discountPercent > 0 ? `ลด ${customer.tier.discountPercent}%` : 'ระดับสมาชิก'}
            </p>
          </div>
          <div className="flex-1 rounded-lg bg-stone-100 py-2">
            <p className="font-bold text-charcoal">{money(customer.lifetimeSpend)}</p>
            <p className="text-stone-500">ยอดสะสม</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <p className="label">ค้นหาสมาชิก</p>
      <div className="flex gap-2">
        <input
          className="input"
          inputMode="tel"
          placeholder="เบอร์โทรศัพท์"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn-primary shrink-0" onClick={search} disabled={status === 'searching'}>
          {status === 'searching' ? '…' : 'ค้นหา'}
        </button>
      </div>

      {status === 'notfound' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">ไม่พบสมาชิก ต้องการสมัคร {phone} หรือไม่?</p>
          <input
            className="input mt-2"
            placeholder="ชื่อลูกค้า (ไม่บังคับ)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button className="btn-lime flex-1" onClick={register}>สมัครและผูกกับบิล</button>
            <button className="btn-ghost" onClick={() => setStatus('idle')}>ข้าม</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-chilli-700">{error}</p>}
      <p className="mt-2 text-xs text-stone-400">ทดลอง: 0812345678 หรือ 0899999999</p>
    </section>
  );
}
