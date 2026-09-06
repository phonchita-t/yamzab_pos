import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { money, dateShort } from '../../lib/format.js';
import Modal from '../../components/Modal.jsx';

export default function MembersPage() {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tiers, setTiers] = useState([]);

  const search = (query = q) => api.get('/customers', { q: query }).then(setList);

  useEffect(() => {
    search('');
    api.get('/tiers').then(setTiers);
  }, []);

  const openDetail = (id) => api.get(`/customers/${id}`).then(setSelected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Members & loyalty</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {tiers.map((t) => (
          <span
            key={t.id}
            className="rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: t.color }}
          >
            {t.name} · {t.minPoints}+ pts · {Number(t.discountPercent)}% off · ×{Number(t.pointsMultiplier)} pts
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="input max-w-sm"
          placeholder="Search by phone or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn-primary" onClick={() => search()}>
          Search
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">Member</th>
              <th className="px-4 py-2.5">Phone</th>
              <th className="px-4 py-2.5">Tier</th>
              <th className="px-4 py-2.5">Points</th>
              <th className="px-4 py-2.5">Visits</th>
              <th className="px-4 py-2.5">Lifetime spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {list.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-stone-50"
                onClick={() => openDetail(c.id)}
              >
                <td className="px-4 py-2.5 font-semibold">{c.fullName || '—'}</td>
                <td className="px-4 py-2.5 text-stone-500">{c.phone}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: c.tier?.color || '#9ca3af' }}
                  >
                    {c.tier?.name || 'Member'}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-bold">{c.pointsBalance}</td>
                <td className="px-4 py-2.5 text-stone-500">{c.visitCount}</td>
                <td className="px-4 py-2.5">{money(c.lifetimeSpend)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <MemberDetail
          member={selected}
          onClose={() => setSelected(null)}
          onChanged={(m) => {
            setSelected(m);
            search();
          }}
        />
      )}
    </div>
  );
}

function MemberDetail({ member, onClose, onChanged }) {
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const adjust = async () => {
    setError('');
    try {
      const updated = await api.post(`/customers/${member.id}/adjust-points`, {
        points: Number(points),
        note,
      });
      onChanged(updated);
      setPoints('');
      setNote('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal open onClose={onClose} title={member.fullName || member.phone} size="lg">
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-sm text-stone-500">{member.phone}</p>
            <div className="mt-2 flex gap-2 text-center text-xs">
              <div className="flex-1 rounded-lg bg-stone-100 py-2">
                <p className="text-lg font-extrabold">{member.pointsBalance}</p>
                <p className="text-stone-500">points</p>
              </div>
              <div className="flex-1 rounded-lg bg-stone-100 py-2">
                <p className="text-lg font-extrabold">{member.lifetimePoints}</p>
                <p className="text-stone-500">lifetime pts</p>
              </div>
              <div className="flex-1 rounded-lg bg-stone-100 py-2">
                <p className="text-lg font-extrabold" style={{ color: member.tier?.color }}>
                  {member.tier?.name || 'Member'}
                </p>
                <p className="text-stone-500">tier</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <p className="label">Manual point adjustment</p>
            <div className="flex gap-2">
              <input
                type="number"
                className="input"
                placeholder="+ / − points"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
            <input
              className="input mt-2"
              placeholder="Reason (required)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && <p className="mt-1 text-sm text-chilli-700">{error}</p>}
            <button className="btn-primary mt-2 w-full" disabled={!points || !note} onClick={adjust}>
              Apply adjustment
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="label">Recent orders</p>
            <ul className="space-y-1.5 text-sm">
              {(member.orders || []).map((o) => (
                <li key={o.id} className="flex justify-between rounded-lg bg-stone-50 px-3 py-1.5">
                  <span>#{o.orderNumber} · {dateShort(o.placedAt)}</span>
                  <span className="font-semibold">{money(o.total)}</span>
                </li>
              ))}
              {!member.orders?.length && <li className="text-stone-400">No orders yet</li>}
            </ul>
          </div>
          <div>
            <p className="label">Loyalty ledger</p>
            <ul className="space-y-1.5 text-sm">
              {(member.loyaltyTransactions || []).map((t) => (
                <li key={t.id} className="flex justify-between rounded-lg bg-stone-50 px-3 py-1.5">
                  <span className="text-stone-500">
                    {t.type} · {dateShort(t.createdAt)}
                  </span>
                  <span className={`font-semibold ${t.points >= 0 ? 'text-lime-600' : 'text-chilli-600'}`}>
                    {t.points >= 0 ? '+' : ''}
                    {t.points}
                  </span>
                </li>
              ))}
              {!member.loyaltyTransactions?.length && <li className="text-stone-400">No activity</li>}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}
