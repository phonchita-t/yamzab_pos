import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import Modal from '../../components/Modal.jsx';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [move, setMove] = useState(null);

  const load = () => api.get('/menu/inventory').then(setItems);
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Inventory</h1>
      <p className="text-sm text-stone-500">
        Stock is decremented automatically on every sale. Record purchases, waste, and manual counts here.
      </p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">In stock</th>
              <th className="px-4 py-2.5">Reorder at</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((p) => {
              const low = Number(p.stockQty) <= Number(p.reorderLevel);
              return (
                <tr key={p.id} className={low ? 'bg-chilli-50/50' : ''}>
                  <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5 text-stone-500">{p.category?.name}</td>
                  <td className={`px-4 py-2.5 font-bold ${low ? 'text-chilli-600' : ''}`}>
                    {Number(p.stockQty)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{Number(p.reorderLevel)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="text-chilli-600 hover:underline" onClick={() => setMove(p)}>
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-400">
                  No inventory-tracked products. Enable "Track inventory" on a menu item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {move && (
        <MovementForm
          product={move}
          onClose={() => setMove(null)}
          onDone={() => {
            setMove(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MovementForm({ product, onClose, onDone }) {
  const [type, setType] = useState('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      await api.post(`/menu/inventory/${product.id}/movement`, {
        type,
        quantity: Number(quantity),
        note: note || undefined,
      });
      onDone();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Adjust: ${product.name}`} size="sm">
      <div className="space-y-3 p-5">
        <div>
          <label className="label">Movement type</label>
          <div className="grid grid-cols-3 gap-2">
            {['PURCHASE', 'WASTE', 'ADJUSTMENT'].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-xl border-2 py-2 text-xs font-semibold ${
                  type === t ? 'border-chilli-500 bg-chilli-50' : 'border-stone-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">
            Quantity {type === 'ADJUSTMENT' ? '(signed delta)' : type === 'WASTE' ? '(will be subtracted)' : '(added)'}
          </label>
          <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className="label">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-sm text-chilli-700">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={!quantity}>
          Record movement
        </button>
      </div>
    </Modal>
  );
}
