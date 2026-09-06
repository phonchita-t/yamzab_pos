import { createContext, useContext, useMemo, useReducer, useCallback } from 'react';

/**
 * Cart line shape:
 * {
 *   uid, product, quantity,
 *   spiceLevel, plaRa,
 *   options: [{ id, name, priceDelta }],
 *   note
 * }
 */

const CartContext = createContext(null);
let counter = 0;
const uid = () => `line_${Date.now()}_${counter++}`;

function lineUnit(line) {
  const opts = line.options.reduce((s, o) => s + Number(o.priceDelta), 0);
  return Number(line.product.price) + opts;
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const line = { uid: uid(), quantity: 1, options: [], note: '', ...action.line };
      return [...state, line];
    }
    case 'UPDATE':
      return state.map((l) => (l.uid === action.uid ? { ...l, ...action.patch } : l));
    case 'QTY':
      return state
        .map((l) => (l.uid === action.uid ? { ...l, quantity: Math.max(0, l.quantity + action.delta) } : l))
        .filter((l) => l.quantity > 0);
    case 'REMOVE':
      return state.filter((l) => l.uid !== action.uid);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(reducer, []);

  const addLine = useCallback((line) => dispatch({ type: 'ADD', line }), []);
  const updateLine = useCallback((uid, patch) => dispatch({ type: 'UPDATE', uid, patch }), []);
  const changeQty = useCallback((uid, delta) => dispatch({ type: 'QTY', uid, delta }), []);
  const removeLine = useCallback((uid) => dispatch({ type: 'REMOVE', uid }), []);
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + lineUnit(l) * l.quantity, 0),
    [lines],
  );
  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const toCheckoutItems = useCallback(
    () =>
      lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
        spiceLevel: l.spiceLevel,
        plaRa: l.plaRa,
        note: l.note || undefined,
        optionIds: l.options.map((o) => o.id),
      })),
    [lines],
  );

  const value = {
    lines,
    addLine,
    updateLine,
    changeQty,
    removeLine,
    clear,
    subtotal,
    itemCount,
    lineUnit,
    toCheckoutItems,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
