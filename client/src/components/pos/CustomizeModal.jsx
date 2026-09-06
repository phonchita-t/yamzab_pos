import { useMemo, useState } from 'react';
import Modal from '../Modal.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { SPICE_LEVELS } from '../../lib/constants.js';
import { money } from '../../lib/format.js';

/**
 * Add a new customised line, or edit an existing one (`line` prop).
 */
export default function CustomizeModal({ product, line, onClose }) {
  const cart = useCart();
  const editing = Boolean(line);

  const optionGroups = useMemo(
    () => (product.optionGroups || []).map((pg) => pg.optionGroup).sort((a, b) => a.sortOrder - b.sortOrder),
    [product],
  );

  const [spiceLevel, setSpiceLevel] = useState(line?.spiceLevel || product.defaultSpice || 'MEDIUM');
  const [plaRa, setPlaRa] = useState(line?.plaRa ?? false);
  const [note, setNote] = useState(line?.note || '');
  const [selected, setSelected] = useState(() => {
    const map = {};
    for (const g of optionGroups) map[g.id] = [];
    for (const o of line?.options || []) {
      const g = optionGroups.find((grp) => grp.options.some((x) => x.id === o.id));
      if (g) map[g.id] = [...(map[g.id] || []), o.id];
    }
    return map;
  });

  const toggleOption = (group, optionId) => {
    setSelected((prev) => {
      const cur = prev[group.id] || [];
      if (cur.includes(optionId)) return { ...prev, [group.id]: cur.filter((x) => x !== optionId) };
      if (group.maxSelect === 1) return { ...prev, [group.id]: [optionId] };
      if (cur.length >= group.maxSelect) return prev;
      return { ...prev, [group.id]: [...cur, optionId] };
    });
  };

  const chosenOptions = optionGroups.flatMap((g) =>
    (selected[g.id] || []).map((id) => g.options.find((o) => o.id === id)).filter(Boolean),
  );
  const optionsTotal = chosenOptions.reduce((s, o) => s + Number(o.priceDelta), 0);
  const unitPreview = Number(product.price) + optionsTotal;

  const requiredMissing = optionGroups.some(
    (g) => g.isRequired && (selected[g.id] || []).length < Math.max(1, g.minSelect),
  );

  const submit = () => {
    const payload = {
      spiceLevel: product.allowsSpice ? spiceLevel : 'NONE',
      plaRa: product.allowsPlaRa ? plaRa : false,
      note,
      options: chosenOptions.map((o) => ({ id: o.id, name: o.name, priceDelta: Number(o.priceDelta) })),
    };
    if (editing) cart.updateLine(line.uid, payload);
    else cart.addLine({ product, quantity: 1, ...payload });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={product.name} size="md">
      <div className="space-y-5 p-5">
        {product.nameTh && <p className="-mt-2 text-sm text-stone-400">{product.nameTh}</p>}

        {/* Spice */}
        {product.allowsSpice && (
          <section>
            <p className="label">Spicy level · ระดับความเผ็ด</p>
            <div className="grid grid-cols-3 gap-2">
              {SPICE_LEVELS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSpiceLevel(s.key)}
                  className={`rounded-xl border-2 px-2 py-2 text-center text-xs font-semibold transition ${
                    spiceLevel === s.key ? 'border-chilli-500 bg-chilli-50' : 'border-stone-200'
                  }`}
                >
                  <span className="block text-base">{s.peppers === 0 ? '🚫' : '🌶️'.repeat(s.peppers)}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Pla Ra */}
        {product.allowsPlaRa && (
          <section className="flex items-center justify-between rounded-xl bg-fishsauce/10 px-4 py-3">
            <div>
              <p className="font-semibold text-fishsauce">Fermented fish sauce · ปลาร้า</p>
              <p className="text-xs text-stone-500">Add Pla Ra to this dish</p>
            </div>
            <button
              onClick={() => setPlaRa((v) => !v)}
              className={`h-7 w-12 rounded-full transition ${plaRa ? 'bg-fishsauce' : 'bg-stone-300'}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white transition ${plaRa ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </section>
        )}

        {/* Option groups: protein / add-ons */}
        {optionGroups.map((g) => (
          <section key={g.id}>
            <p className="label">
              {g.name} {g.nameTh && <span className="text-stone-400">· {g.nameTh}</span>}
              {g.isRequired && <span className="ml-1 text-chilli-600">*</span>}
              {g.maxSelect > 1 && <span className="ml-1 normal-case text-stone-400">(up to {g.maxSelect})</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {g.options
                .filter((o) => o.isActive)
                .map((o) => {
                  const on = (selected[g.id] || []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOption(g, o.id)}
                      className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-left text-sm transition ${
                        on ? 'border-lime-500 bg-lime-50' : 'border-stone-200'
                      }`}
                    >
                      <span className="font-medium">{o.name}</span>
                      {Number(o.priceDelta) > 0 && (
                        <span className="text-xs text-stone-500">+{money(o.priceDelta)}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}

        {/* Note */}
        <section>
          <p className="label">Kitchen note</p>
          <input
            className="input"
            placeholder="e.g. no peanuts, extra lime, separate sauce"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-stone-200 p-4">
        <span className="text-lg font-extrabold">{money(unitPreview)}</span>
        <button className="btn-primary flex-1" disabled={requiredMissing} onClick={submit}>
          {editing ? 'Update item' : 'Add to order'}
        </button>
      </div>
    </Modal>
  );
}
