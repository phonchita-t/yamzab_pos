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
      if (err.status === 404) setStatus('notfound');
      else setError(err.message), setStatus('idle');
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
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Member</p>
            <p className="font-bold">{customer.fullName || 'Unnamed member'}</p>
            <p className="text-sm text-stone-500">{customer.phone}</p>
          </div>
          <button
            className="text-xs font-semibold text-stone-400 hover:text-chilli-600"
            onClick={() => onSelect(null)}
          >
            Remove
          </button>
        </div>
        <div className="mt-3 flex gap-2 text-center text-xs">
          <div className="flex-1 rounded-lg bg-stone-100 py-2">
            <p className="font-bold text-charcoal">{customer.pointsBalance}</p>
            <p className="text-stone-500">points</p>
          </div>
          <div className="flex-1 rounded-lg bg-stone-100 py-2">
            <p className="font-bold" style={{ color: customer.tier?.color }}>
              {customer.tier?.name || 'Member'}
            </p>
            <p className="text-stone-500">
              {customer.tier?.discountPercent > 0 ? `${customer.tier.discountPercent}% off` : 'tier'}
            </p>
          </div>
          <div className="flex-1 rounded-lg bg-stone-100 py-2">
            <p className="font-bold text-charcoal">{money(customer.lifetimeSpend)}</p>
            <p className="text-stone-500">lifetime</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <p className="label">Member lookup · ค้นหาสมาชิก</p>
      <div className="flex gap-2">
        <input
          className="input"
          inputMode="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn-primary shrink-0" onClick={search} disabled={status === 'searching'}>
          {status === 'searching' ? '…' : 'Find'}
        </button>
      </div>

      {status === 'notfound' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">No member found. Register {phone}?</p>
          <input
            className="input mt-2"
            placeholder="Customer name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button className="btn-lime flex-1" onClick={register}>Register & attach</button>
            <button className="btn-ghost" onClick={() => setStatus('idle')}>Skip</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-chilli-700">{error}</p>}
      <p className="mt-2 text-xs text-stone-400">Try demo: 0812345678 or 0899999999</p>
    </section>
  );
}
