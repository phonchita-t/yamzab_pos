import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const QUICK = [
  { role: 'Admin', username: 'admin', desc: 'Dashboard, reports, menu, inventory, staff' },
  { role: 'Cashier', username: 'cashier', desc: 'POS, orders, payments, kitchen display' },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate(user.role === 'ADMIN' ? '/admin' : '/pos', { replace: true });
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.username.trim(), form.password);
      navigate(u.role === 'ADMIN' ? '/admin' : '/pos', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-chilli-600 via-chilli-700 to-charcoal p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="text-5xl">🌶️🥗</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Yam Zabb POS</h1>
          <p className="text-sm text-chilli-100">แซ่บเวอร์ — Spicy Salad Point of Sale</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              autoFocus
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="admin / cashier"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-chilli-50 px-3 py-2 text-sm font-medium text-chilli-700">{error}</p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="border-t border-stone-200 pt-3">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-400">
              Demo accounts (password: password123)
            </p>
            <div className="grid gap-2">
              {QUICK.map((q) => (
                <button
                  type="button"
                  key={q.username}
                  onClick={() => setForm({ username: q.username, password: 'password123' })}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-left text-sm hover:border-chilli-400 hover:bg-chilli-50"
                >
                  <span className="font-bold">{q.role}</span>{' '}
                  <span className="text-stone-400">· {q.username}</span>
                  <span className="block text-xs text-stone-500">{q.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
