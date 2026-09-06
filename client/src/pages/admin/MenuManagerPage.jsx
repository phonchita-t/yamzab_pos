import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import Modal from '../../components/Modal.jsx';
import { SPICE_LEVELS } from '../../lib/constants.js';

const emptyProduct = {
  name: '',
  nameTh: '',
  categoryId: '',
  price: 0,
  cost: 0,
  defaultSpice: 'MEDIUM',
  allowsSpice: false,
  allowsPlaRa: false,
  allowsProtein: false,
  isAvailable: true,
  trackInventory: false,
  stockQty: 0,
  reorderLevel: 0,
};

export default function MenuManagerPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('all');

  const load = () =>
    Promise.all([
      api.get('/menu/categories'),
      api.get('/menu/products', { includeInactive: true }),
    ]).then(([c, p]) => {
      setCategories(c);
      setProducts(p);
    });

  useEffect(() => {
    load();
  }, []);

  const save = async (form) => {
    const payload = {
      ...form,
      price: Number(form.price),
      cost: Number(form.cost),
      stockQty: Number(form.stockQty),
      reorderLevel: Number(form.reorderLevel),
    };
    if (form.id) await api.patch(`/menu/products/${form.id}`, payload);
    else await api.post('/menu/products', payload);
    setEditing(null);
    load();
  };

  const remove = async (p) => {
    if (!confirm(`Deactivate "${p.name}"?`)) return;
    await api.del(`/menu/products/${p.id}`);
    load();
  };

  const toggleAvail = async (p) => {
    await api.patch(`/menu/products/${p.id}/availability`, { isAvailable: !p.isAvailable });
    load();
  };

  const shown = products.filter((p) => tab === 'all' || p.categoryId === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Menu management</h1>
        <button className="btn-primary" onClick={() => setEditing({ ...emptyProduct, categoryId: categories[0]?.id })}>
          + Add item
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <FilterChip active={tab === 'all'} onClick={() => setTab('all')}>All</FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.id} active={tab === c.id} onClick={() => setTab(c.id)}>
            {c.icon} {c.name}
          </FilterChip>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Customise</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {shown.map((p) => (
              <tr key={p.id} className={p.isActive ? '' : 'opacity-40'}>
                <td className="px-4 py-2.5">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.nameTh}</p>
                </td>
                <td className="px-4 py-2.5 text-stone-500">{p.category?.name}</td>
                <td className="px-4 py-2.5 font-semibold">{money(p.price)}</td>
                <td className="px-4 py-2.5 text-xs">
                  {p.allowsSpice && <Tag>🌶️ spice</Tag>}
                  {p.allowsPlaRa && <Tag>ปลาร้า</Tag>}
                  {p.allowsProtein && <Tag>protein</Tag>}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleAvail(p)}
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      p.isAvailable ? 'bg-lime-100 text-lime-700' : 'bg-chilli-100 text-chilli-700'
                    }`}
                  >
                    {p.isAvailable ? 'Available' : 'Sold out'}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button className="text-chilli-600 hover:underline" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button className="ml-3 text-stone-400 hover:text-chilli-600" onClick={() => remove(p)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductForm
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function ProductForm({ initial, categories, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit item' : 'New item'} size="md">
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name (EN)</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Name (TH)</label>
          <input className="input" value={form.nameTh || ''} onChange={(e) => set('nameTh', e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Price (฿)</label>
          <input type="number" className="input" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </div>
        <div>
          <label className="label">Cost (฿)</label>
          <input type="number" className="input" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
        </div>

        <div className="sm:col-span-2 grid grid-cols-3 gap-2">
          <Toggle label="Spicy options" checked={form.allowsSpice} onChange={(v) => set('allowsSpice', v)} />
          <Toggle label="Pla Ra option" checked={form.allowsPlaRa} onChange={(v) => set('allowsPlaRa', v)} />
          <Toggle label="Protein choice" checked={form.allowsProtein} onChange={(v) => set('allowsProtein', v)} />
        </div>

        {form.allowsSpice && (
          <div className="sm:col-span-2">
            <label className="label">Default spice</label>
            <select className="input" value={form.defaultSpice} onChange={(e) => set('defaultSpice', e.target.value)}>
              {SPICE_LEVELS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <Toggle label="Track inventory" checked={form.trackInventory} onChange={(v) => set('trackInventory', v)} />
        </div>
        {form.trackInventory && (
          <>
            <div>
              <label className="label">Stock qty</label>
              <input type="number" className="input" value={form.stockQty} onChange={(e) => set('stockQty', e.target.value)} />
            </div>
            <div>
              <label className="label">Reorder level</label>
              <input type="number" className="input" value={form.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)} />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 border-t border-stone-200 p-4">
        <button className="btn-ghost flex-1" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary flex-1" onClick={() => onSave(form)} disabled={!form.name || !form.categoryId}>
          Save
        </button>
      </div>
    </Modal>
  );
}

const Tag = ({ children }) => (
  <span className="mr-1 inline-block rounded bg-stone-100 px-1.5 py-0.5">{children}</span>
);

const FilterChip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
      active ? 'bg-charcoal text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'
    }`}
  >
    {children}
  </button>
);

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-medium ${
        checked ? 'border-lime-500 bg-lime-50' : 'border-stone-200'
      }`}
    >
      {label}
      <span className={`ml-2 h-4 w-4 rounded ${checked ? 'bg-lime-500' : 'bg-stone-300'}`} />
    </button>
  );
}
