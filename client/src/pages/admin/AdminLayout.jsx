import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV = [
  { to: '/admin', end: true, label: 'แดชบอร์ด', icon: '📊' },
  { to: '/admin/reports', label: 'รายงานยอดขาย', icon: '🧾' },
  { to: '/admin/menu', label: 'จัดการเมนู', icon: '🥗' },
  { to: '/admin/inventory', label: 'คลังสินค้า', icon: '📦' },
  { to: '/admin/members', label: 'สมาชิก', icon: '🪪' },
  { to: '/admin/staff', label: 'พนักงาน', icon: '👥' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full bg-stone-100">
      <aside className="flex w-16 shrink-0 flex-col border-r border-stone-200 bg-white md:w-56">
        <div className="flex items-center gap-2 px-3 py-4 md:px-4">
          <span className="text-xl">🌶️</span>
          <span className="hidden font-extrabold md:inline">ยำแซ่บ</span>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-chilli-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`
              }
            >
              <span>{n.icon}</span>
              <span className="hidden md:inline">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-stone-200 p-2">
          <Link to="/pos" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-100">
            <span>🛒</span>
            <span className="hidden md:inline">เปิดหน้าขาย</span>
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-100"
          >
            <span>🚪</span>
            <span className="hidden md:inline">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <p className="mb-4 text-sm text-stone-400">เข้าสู่ระบบในชื่อ {user?.fullName} · ผู้ดูแลระบบ</p>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
