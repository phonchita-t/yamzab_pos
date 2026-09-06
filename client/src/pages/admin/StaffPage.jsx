import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { dateShort } from '../../lib/format.js';
import Modal from '../../components/Modal.jsx';

const empty = { username: '', fullName: '', email: '', password: '', role: 'CASHIER' };

export default function StaffPage() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/users').then(setUsers);
  useEffect(() => {
    load();
  }, []);

  const save = async (form) => {
    if (form.id) {
      const patch = { fullName: form.fullName, role: form.role, isActive: form.isActive };
      if (form.password) patch.password = form.password;
      if (form.email) patch.email = form.email;
      await api.patch(`/users/${form.id}`, patch);
    } else {
      await api.post('/users', form);
    }
    setEditing(null);
    load();
  };

  const deactivate = async (u) => {
    if (!confirm(`Deactivate ${u.fullName}?`)) return;
    await api.del(`/users/${u.id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Staff & access</h1>
        <button className="btn-primary" onClick={() => setEditing({ ...empty })}>
          + Add staff
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleCard
          title="Admin"
          color="bg-chilli-600"
          items={['Dashboard & analytics', 'Sales reports', 'Menu & pricing', 'Inventory', 'Members & loyalty', 'Staff management']}
        />
        <RoleCard
          title="Cashier"
          color="bg-lime-600"
          items={['POS cashier screen', 'Order customisation', 'Payments (cash / QR / card)', 'Member lookup at checkout', 'Kitchen display']}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Username</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Last login</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-40'}>
                <td className="px-4 py-2.5 font-semibold">{u.fullName}</td>
                <td className="px-4 py-2.5 text-stone-500">{u.username}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${
                      u.role === 'ADMIN' ? 'bg-chilli-600' : 'bg-lime-600'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-stone-500">
                  {u.lastLoginAt ? dateShort(u.lastLoginAt) : 'never'}
                </td>
                <td className="px-4 py-2.5">{u.isActive ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-2.5 text-right">
                  <button className="text-chilli-600 hover:underline" onClick={() => setEditing(u)}>
                    Edit
                  </button>
                  {u.isActive && (
                    <button className="ml-3 text-stone-400 hover:text-chilli-600" onClick={() => deactivate(u)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <StaffForm initial={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function RoleCard({ title, color, items }) {
  return (
    <div className="card overflow-hidden">
      <div className={`${color} px-4 py-2 font-bold text-white`}>{title}</div>
      <ul className="space-y-1 p-4 text-sm text-stone-600">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-lime-500">✓</span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ isActive: true, ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !form.id;

  return (
    <Modal open onClose={onClose} title={isNew ? 'New staff member' : `Edit ${form.fullName}`} size="sm">
      <div className="space-y-3 p-5">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </div>
        <div>
          <label className="label">Username</label>
          <input
            className="input disabled:bg-stone-100"
            value={form.username}
            disabled={!isNew}
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Email (optional)</label>
          <input className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Role</label>
          <div className="grid grid-cols-2 gap-2">
            {['CASHIER', 'ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => set('role', r)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold ${
                  form.role === r ? 'border-chilli-500 bg-chilli-50' : 'border-stone-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{isNew ? 'Password' : 'Reset password (optional)'}</label>
          <input
            type="password"
            className="input"
            value={form.password || ''}
            onChange={(e) => set('password', e.target.value)}
          />
        </div>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            Active
          </label>
        )}
      </div>
      <div className="flex gap-2 border-t border-stone-200 p-4">
        <button className="btn-ghost flex-1" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary flex-1"
          disabled={!form.fullName || !form.username || (isNew && !form.password)}
          onClick={() => onSave(form)}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
