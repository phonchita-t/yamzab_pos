import { useEffect, useState } from 'react';
import { db } from '../../lib/store.js';
import { dateShort } from '../../lib/format.js';
import { roleLabel } from '../../lib/constants.js';
import Modal from '../../components/Modal.jsx';

const empty = { username: '', fullName: '', email: '', password: '', role: 'CASHIER' };

export default function StaffPage() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => setUsers(db.getUsers());
  useEffect(() => {
    load();
  }, []);

  const save = (form) => {
    try {
      if (form.id) {
        const patch = { fullName: form.fullName, role: form.role, isActive: form.isActive };
        if (form.password) patch.password = form.password;
        if (form.email) patch.email = form.email;
        db.updateUser(form.id, patch);
      } else {
        db.createUser(form);
      }
      setEditing(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const deactivate = (u) => {
    if (!confirm(`ปิดการใช้งานบัญชีของ ${u.fullName} หรือไม่?`)) return;
    try {
      db.deactivateUser(u.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">พนักงานและสิทธิ์การใช้งาน</h1>
        <button className="btn-primary" onClick={() => setEditing({ ...empty })}>
          + เพิ่มพนักงาน
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleCard
          title="ผู้ดูแลระบบ"
          color="bg-chilli-600"
          items={['แดชบอร์ดและสถิติ', 'รายงานยอดขาย', 'เมนูและราคา', 'คลังสินค้า', 'สมาชิกและแต้มสะสม', 'จัดการพนักงาน']}
        />
        <RoleCard
          title="แคชเชียร์"
          color="bg-lime-600"
          items={['หน้าจอขายหน้าร้าน', 'ปรับแต่งรายการอาหาร', 'รับชำระเงิน (เงินสด / QR / บัตร)', 'ค้นหาสมาชิกตอนคิดเงิน']}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-2.5">ชื่อ</th>
              <th className="px-4 py-2.5">ชื่อผู้ใช้</th>
              <th className="px-4 py-2.5">บทบาท</th>
              <th className="px-4 py-2.5">เข้าสู่ระบบล่าสุด</th>
              <th className="px-4 py-2.5">สถานะ</th>
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
                    {roleLabel(u.role)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-stone-500">
                  {u.lastLoginAt ? dateShort(u.lastLoginAt) : 'ยังไม่เคย'}
                </td>
                <td className="px-4 py-2.5">{u.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
                <td className="px-4 py-2.5 text-right">
                  <button className="text-chilli-600 hover:underline" onClick={() => setEditing(u)}>
                    แก้ไข
                  </button>
                  {u.isActive && (
                    <button className="ml-3 text-stone-400 hover:text-chilli-600" onClick={() => deactivate(u)}>
                      ปิดการใช้งาน
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
    <Modal open onClose={onClose} title={isNew ? 'เพิ่มพนักงานใหม่' : `แก้ไข ${form.fullName}`} size="sm">
      <div className="space-y-3 p-5">
        <div>
          <label className="label">ชื่อ-นามสกุล</label>
          <input className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </div>
        <div>
          <label className="label">ชื่อผู้ใช้</label>
          <input
            className="input disabled:bg-stone-100"
            value={form.username}
            disabled={!isNew}
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
        <div>
          <label className="label">อีเมล (ไม่บังคับ)</label>
          <input className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">บทบาท</label>
          <div className="grid grid-cols-2 gap-2">
            {['CASHIER', 'ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => set('role', r)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold ${
                  form.role === r ? 'border-chilli-500 bg-chilli-50' : 'border-stone-200'
                }`}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{isNew ? 'รหัสผ่าน' : 'ตั้งรหัสผ่านใหม่ (ไม่บังคับ)'}</label>
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
            เปิดใช้งาน
          </label>
        )}
      </div>
      <div className="flex gap-2 border-t border-stone-200 p-4">
        <button className="btn-ghost flex-1" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="btn-primary flex-1"
          disabled={!form.fullName || !form.username || (isNew && !form.password)}
          onClick={() => onSave(form)}
        >
          บันทึก
        </button>
      </div>
    </Modal>
  );
}
