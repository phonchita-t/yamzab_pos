import { useEffect, useState } from 'react';
import { db } from '../../lib/store.js';
import Modal from '../../components/Modal.jsx';
import { MOVEMENT_TYPES } from '../../lib/constants.js';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [move, setMove] = useState(null);

  const load = () => setItems(db.getInventory());
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">คลังสินค้า</h1>
      <p className="text-sm text-stone-500">
        ระบบจะตัดสต็อกอัตโนมัติทุกครั้งที่มีการขาย บันทึกการรับเข้า ของเสีย และการนับสต็อกได้ที่นี่
      </p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">เมนู</th>
              <th className="px-4 py-2.5">หมวดหมู่</th>
              <th className="px-4 py-2.5">คงเหลือ</th>
              <th className="px-4 py-2.5">จุดสั่งซื้อ</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((p) => {
              const low = Number(p.stockQty) <= Number(p.reorderLevel);
              return (
                <tr key={p.id} className={low ? 'bg-chilli-50/50' : ''}>
                  <td className="px-4 py-2.5 font-semibold">{p.nameTh || p.name}</td>
                  <td className="px-4 py-2.5 text-stone-500">{p.category?.nameTh || p.category?.name}</td>
                  <td className={`px-4 py-2.5 font-bold ${low ? 'text-chilli-600' : ''}`}>
                    {Number(p.stockQty)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{Number(p.reorderLevel)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="text-chilli-600 hover:underline" onClick={() => setMove(p)}>
                      ปรับยอด
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-400">
                  ยังไม่มีสินค้าที่ติดตามสต็อก เปิด "ติดตามสต็อก" ในเมนูสินค้าก่อน
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

  const submit = () => {
    setError('');
    try {
      db.recordStockMovement(product.id, {
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
    <Modal open onClose={onClose} title={`ปรับยอด: ${product.nameTh || product.name}`} size="sm">
      <div className="space-y-3 p-5">
        <div>
          <label className="label">ประเภทรายการ</label>
          <div className="grid grid-cols-3 gap-2">
            {['PURCHASE', 'WASTE', 'ADJUSTMENT'].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-xl border-2 py-2 text-xs font-semibold ${
                  type === t ? 'border-chilli-500 bg-chilli-50' : 'border-stone-200'
                }`}
              >
                {MOVEMENT_TYPES[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">
            จำนวน {type === 'ADJUSTMENT' ? '(ใส่ค่าบวก/ลบ)' : type === 'WASTE' ? '(จะถูกหักออก)' : '(เพิ่มเข้า)'}
          </label>
          <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className="label">หมายเหตุ</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-sm text-chilli-700">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={!quantity}>
          บันทึกรายการ
        </button>
      </div>
    </Modal>
  );
}
