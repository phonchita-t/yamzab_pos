import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { money, nameOf } from '../lib/format.js';
import SpiceMeter from '../components/SpiceMeter.jsx';
import CustomizeModal from '../components/pos/CustomizeModal.jsx';
import CheckoutModal from '../components/pos/CheckoutModal.jsx';

export default function POSPage() {
  const { user, logout } = useAuth();
  const cart = useCart();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [customizing, setCustomizing] = useState(null); // product | { line }
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/menu/categories'), api.get('/menu/products')])
      .then(([cats, prods]) => {
        setCategories(cats.filter((c) => c.isActive));
        setProducts(prods);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== 'all' && p.categoryId !== activeCat) return false;
      if (q && !`${p.name} ${p.nameTh || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCat, search]);

  const openProduct = (product) => {
    const needsChoice = product.allowsSpice || product.allowsPlaRa || product.optionGroups?.length;
    if (needsChoice) {
      setCustomizing({ product });
    } else {
      cart.addLine({ product, spiceLevel: 'NONE', plaRa: false });
    }
  };

  return (
    <div className="flex h-full flex-col bg-stone-100 lg:flex-row">
      {/* ---------- Menu column ---------- */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <span className="text-xl">🌶️🥗</span>
          <h1 className="text-lg font-extrabold">ยำแซ่บ POS</h1>
          <input
            className="input ml-2 max-w-xs"
            placeholder="ค้นหาเมนู…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link to="/kds" className="btn-ghost !py-2">🍳 จอครัว</Link>
            {user?.role === 'ADMIN' && <Link to="/admin" className="btn-ghost !py-2">ผู้ดูแลระบบ</Link>}
            <span className="hidden text-stone-500 sm:inline">{user?.fullName}</span>
            <button onClick={logout} className="btn-ghost !py-2">ออกจากระบบ</button>
          </div>
        </header>

        {/* category tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-stone-200 bg-white px-4 py-2">
          <CatTab active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="ทั้งหมด" icon="🍽️" />
          {categories.map((c) => (
            <CatTab
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              label={nameOf(c)}
              icon={c.icon}
              color={c.color}
            />
          ))}
        </div>

        {/* grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-stone-400">กำลังโหลดเมนู…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  disabled={!p.isAvailable}
                  onClick={() => openProduct(p)}
                  className="card group flex flex-col p-3 text-left transition hover:ring-chilli-400 disabled:opacity-40"
                >
                  <div
                    className="mb-2 grid h-20 place-items-center rounded-xl text-3xl"
                    style={{ backgroundColor: `${p.category?.color || '#ef4444'}18` }}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      <span>{p.category?.slug === 'drinks' ? '🥤' : '🥗'}</span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{nameOf(p)}</span>
                  {p.nameTh && p.name && p.nameTh !== p.name && (
                    <span className="text-xs text-stone-400">{p.name}</span>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-bold text-chilli-700">{money(p.price)}</span>
                    {p.allowsSpice && <SpiceMeter level={p.defaultSpice} />}
                  </div>
                  {!p.isAvailable && (
                    <span className="mt-1 text-xs font-bold uppercase text-chilli-600">ของหมด</span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && <p className="text-stone-400">ไม่พบเมนูที่ตรงกับคำค้นหา</p>}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Cart column ---------- */}
      <aside className="flex w-full shrink-0 flex-col border-t border-stone-200 bg-white lg:w-96 lg:border-l lg:border-t-0">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-base font-bold">
            ออเดอร์ปัจจุบัน{' '}
            <span className="ml-1 rounded-full bg-chilli-100 px-2 py-0.5 text-xs font-bold text-chilli-700">
              {cart.itemCount}
            </span>
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {cart.lines.length === 0 && (
            <p className="mt-10 text-center text-sm text-stone-400">
              แตะเมนูเพื่อเริ่มออเดอร์ 🌶️
            </p>
          )}
          {cart.lines.map((l) => (
            <div key={l.uid} className="mb-2 rounded-xl border border-stone-200 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold leading-snug">{nameOf(l.product)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    {l.product.allowsSpice && <SpiceMeter level={l.spiceLevel} />}
                    {l.plaRa && <span className="rounded bg-fishsauce/15 px-1.5 text-fishsauce">+ ปลาร้า</span>}
                    {l.options.map((o) => (
                      <span key={o.id} className="rounded bg-stone-100 px-1.5">{o.name}</span>
                    ))}
                  </div>
                  {l.note && <p className="mt-0.5 text-xs italic text-stone-400">“{l.note}”</p>}
                </div>
                <button
                  onClick={() => setCustomizing({ product: l.product, line: l })}
                  className="text-xs font-semibold text-chilli-600 hover:underline"
                >
                  แก้ไข
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => cart.changeQty(l.uid, -1)} className="h-7 w-7 rounded-lg bg-stone-100 font-bold">−</button>
                  <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                  <button onClick={() => cart.changeQty(l.uid, 1)} className="h-7 w-7 rounded-lg bg-stone-100 font-bold">+</button>
                </div>
                <span className="text-sm font-bold">{money(cart.lineUnit(l) * l.quantity)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-stone-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">ยอดรวม</span>
            <span className="font-semibold">{money(cart.subtotal)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={cart.clear} disabled={!cart.lines.length} className="btn-ghost flex-1">
              ล้าง
            </button>
            <button
              onClick={() => setCheckout(true)}
              disabled={!cart.lines.length}
              className="btn-primary flex-[2] text-base"
            >
              คิดเงิน {money(cart.subtotal)}
            </button>
          </div>
        </div>
      </aside>

      {customizing && (
        <CustomizeModal
          product={customizing.product}
          line={customizing.line}
          onClose={() => setCustomizing(null)}
        />
      )}

      {checkout && <CheckoutModal onClose={() => setCheckout(false)} />}
    </div>
  );
}

function CatTab({ active, onClick, label, icon, color }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-charcoal text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
