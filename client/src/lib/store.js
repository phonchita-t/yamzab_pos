// Local, single-device data layer. Replaces the old Express + Prisma + Postgres
// backend entirely — every "table" lives in one localStorage record, and every
// function below does synchronously what the equivalent server/src/routes/*.js
// endpoint used to do over HTTP. Seed content mirrors the old server/prisma/seed.js.
import { round2, lineTotal, buildBill, resolveTier } from './pricing.js';

const DB_KEY = 'yz_pos_db_v1';
const SESSION_KEY = 'yz_pos_session';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const uid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const nowIso = () => new Date().toISOString();

/* --------------------------------- Seed --------------------------------- */

function seedData() {
  const now = nowIso();

  const users = [
    {
      id: uid(), username: 'admin', fullName: 'สมชาย (เจ้าของร้าน)', email: 'admin@yamzabb.local',
      role: 'ADMIN', password: 'password123', isActive: true, lastLoginAt: null, createdAt: now,
    },
    {
      id: uid(), username: 'cashier', fullName: 'นก (แคชเชียร์)', email: null,
      role: 'CASHIER', password: 'password123', isActive: true, lastLoginAt: null, createdAt: now,
    },
  ];

  const tiers = [
    { id: uid(), name: 'Member', minPoints: 0, discountPercent: 0, pointsMultiplier: 1.0, color: '#9ca3af', sortOrder: 0 },
    { id: uid(), name: 'Silver', minPoints: 500, discountPercent: 5, pointsMultiplier: 1.0, color: '#94a3b8', sortOrder: 1 },
    { id: uid(), name: 'Gold', minPoints: 2000, discountPercent: 10, pointsMultiplier: 1.25, color: '#eab308', sortOrder: 2 },
    { id: uid(), name: 'Zabb Master', minPoints: 5000, discountPercent: 15, pointsMultiplier: 1.5, color: '#dc2626', sortOrder: 3 },
  ];
  const memberTier = tiers[0];
  const goldTier = tiers[2];

  const loyaltyConfig = { pointsPerCurrency: 0.1, currencyPerPoint: 1, minRedeemPoints: 50, maxRedeemPercent: 50 };

  const categoryDefs = [
    { name: 'Yam / Spicy Salads', nameTh: 'ยำแซ่บ', slug: 'yam', color: '#dc2626', icon: '🥗', sortOrder: 0 },
    { name: 'Som Tam', nameTh: 'ส้มตำ', slug: 'som-tam', color: '#16a34a', icon: '🥭', sortOrder: 1 },
    { name: 'Grilled & Larb', nameTh: 'ย่าง / ลาบ', slug: 'grilled', color: '#ea580c', icon: '🍢', sortOrder: 2 },
    { name: 'Sides & Sticky Rice', nameTh: 'ของทานเล่น', slug: 'sides', color: '#ca8a04', icon: '🍚', sortOrder: 3 },
    { name: 'Drinks', nameTh: 'เครื่องดื่ม', slug: 'drinks', color: '#0891b2', icon: '🥤', sortOrder: 4 },
    { name: 'Toppings & Add-ons', nameTh: 'เพิ่มเติม', slug: 'toppings', color: '#7c3aed', icon: '➕', sortOrder: 5 },
  ];
  const categories = categoryDefs.map((c) => ({ id: uid(), isActive: true, ...c }));
  const catId = (slug) => categories.find((c) => c.slug === slug).id;

  const makeGroup = (fields, optionDefs) => ({
    id: uid(),
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
    sortOrder: 0,
    ...fields,
    options: optionDefs.map((o, i) => ({ id: uid(), priceDelta: 0, isActive: true, sortOrder: i, ...o })),
  });

  const proteinGroup = makeGroup(
    { name: 'Protein / Seafood', nameTh: 'เลือกโปรตีน', minSelect: 1, maxSelect: 1, isRequired: true, sortOrder: 0 },
    [
      { name: 'Minced pork', nameTh: 'หมูสับ', priceDelta: 0 },
      { name: 'Sliced chicken', nameTh: 'ไก่ฉีก', priceDelta: 0 },
      { name: 'Shrimp', nameTh: 'กุ้ง', priceDelta: 30 },
      { name: 'Squid', nameTh: 'ปลาหมึก', priceDelta: 30 },
      { name: 'Mixed seafood', nameTh: 'ทะเลรวม', priceDelta: 50 },
      { name: 'Crispy pork', nameTh: 'หมูกรอบ', priceDelta: 20 },
    ],
  );
  const addonGroup = makeGroup(
    { name: 'Extra toppings', nameTh: 'เพิ่มท็อปปิ้ง', minSelect: 0, maxSelect: 5, isRequired: false, sortOrder: 1 },
    [
      { name: 'Salted egg', nameTh: 'ไข่เค็ม', priceDelta: 15 },
      { name: 'Century egg', nameTh: 'ไข่เยี่ยวม้า', priceDelta: 15 },
      { name: 'Extra peanuts', nameTh: 'ถั่วเพิ่ม', priceDelta: 10 },
      { name: 'Crispy shallots', nameTh: 'หอมเจียว', priceDelta: 10 },
      { name: 'Vermicelli', nameTh: 'วุ้นเส้น', priceDelta: 20 },
    ],
  );
  const optionGroups = [proteinGroup, addonGroup];

  const productDefs = [
    // Yam
    { slug: 'yam', name: 'Yam Woon Sen', nameTh: 'ยำวุ้นเส้น', price: 180, allowsSpice: true, allowsPlaRa: true, allowsProtein: true, groupIds: [proteinGroup.id, addonGroup.id] },
    { slug: 'yam', name: 'Yam Mamuang Kung (Mango & Shrimp Salad)', nameTh: 'ยำมะม่วงกุ้ง', price: 150, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Pu Ma (Blue Crab Salad)', nameTh: 'ยำปูม้า', price: 150, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Pla Kulao (Kulao Fish Salad)', nameTh: 'ยำปลากุแล', price: 150, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Pla Muek (Squid Salad)', nameTh: 'ยำปลาหมึก', price: 180, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Khai Maengda (Horseshoe Crab Roe Salad)', nameTh: 'ยำไข่แมงดา', price: 180, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Khai Pu (Crab Roe Salad)', nameTh: 'ยำไข่ปู', price: 180, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Khai Khu (Double Egg Salad)', nameTh: 'ยำไข่คู่', price: 200, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Takrai Kung Sod (Lemongrass & Fresh Shrimp Salad)', nameTh: 'ยำตะไคร้กุ้งสด', price: 150, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Thua Phu (Winged Bean Salad)', nameTh: 'ยำถั่วพู', price: 150, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Hoi Nang Rom (Oyster Salad)', nameTh: 'ยำหอยนางรม', price: 180, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Hoi Nang Rom Sod (Fresh Oysters)', nameTh: 'หอยนางรมสด', price: 180 },
    // Som Tam
    { slug: 'som-tam', name: 'Som Tam Thai', nameTh: 'ส้มตำไทย', price: 69, allowsSpice: true, allowsPlaRa: true },
    { slug: 'som-tam', name: 'Som Tam Pu Pla Ra', nameTh: 'ตำปูปลาร้า', price: 79, allowsSpice: true, allowsPlaRa: true },
    { slug: 'som-tam', name: 'Tam Sua (Vermicelli)', nameTh: 'ตำซั่ว', price: 85, allowsSpice: true, allowsPlaRa: true },
    { slug: 'som-tam', name: 'Som Tam Korat', nameTh: 'ตำโคราช', price: 75, allowsSpice: true, allowsPlaRa: true },
    // Grilled & Larb
    { slug: 'grilled', name: 'Kai Yang (Grilled Chicken) ½', nameTh: 'ไก่ย่างครึ่งตัว', price: 120 },
    { slug: 'grilled', name: 'Nua Yang Jim Jaew', nameTh: 'เนื้อย่างจิ้มแจ่ว', price: 159, allowsSpice: true },
    { slug: 'grilled', name: 'Larb Moo', nameTh: 'ลาบหมู', price: 89, allowsSpice: true, allowsPlaRa: true },
    { slug: 'grilled', name: 'Nam Tok Moo', nameTh: 'น้ำตกหมู', price: 89, allowsSpice: true, allowsPlaRa: true },
    { slug: 'grilled', name: 'Sai Krok Isan', nameTh: 'ไส้กรอกอีสาน', price: 69 },
    // Sides
    { slug: 'sides', name: 'Sticky Rice', nameTh: 'ข้าวเหนียว', price: 15, trackInventory: true, stockQty: 200, reorderLevel: 40 },
    { slug: 'sides', name: 'Pork Rinds (Kaeb Moo)', nameTh: 'แคบหมู', price: 39, trackInventory: true, stockQty: 60, reorderLevel: 15 },
    { slug: 'sides', name: 'Fried Chicken Wings (4)', nameTh: 'ปีกไก่ทอด', price: 89 },
    { slug: 'sides', name: 'Morning Glory Tempura', nameTh: 'ผักบุ้งลอยฟ้า', price: 79 },
    // Drinks
    { slug: 'drinks', name: 'Thai Iced Tea', nameTh: 'ชาไทยเย็น', price: 39, trackInventory: true, stockQty: 80, reorderLevel: 20 },
    { slug: 'drinks', name: 'Coconut Water', nameTh: 'น้ำมะพร้าว', price: 49, trackInventory: true, stockQty: 40, reorderLevel: 12 },
    { slug: 'drinks', name: 'Soda Water', nameTh: 'โซดา', price: 25, trackInventory: true, stockQty: 100, reorderLevel: 24 },
    { slug: 'drinks', name: 'Chang Beer', nameTh: 'เบียร์ช้าง', price: 75, trackInventory: true, stockQty: 48, reorderLevel: 12 },
    { slug: 'drinks', name: 'Bottled Water', nameTh: 'น้ำเปล่า', price: 15, trackInventory: true, stockQty: 150, reorderLevel: 36 },
    // Toppings a la carte
    { slug: 'toppings', name: 'Add Shrimp (5)', nameTh: 'เพิ่มกุ้ง', price: 40 },
    { slug: 'toppings', name: 'Add Salted Egg', nameTh: 'เพิ่มไข่เค็ม', price: 15 },
    { slug: 'toppings', name: 'Extra Pla Ra Sauce', nameTh: 'เพิ่มน้ำปลาร้า', price: 10 },
  ];

  const products = productDefs.map((p, i) => {
    const { slug, groupIds, allowsSpice, ...rest } = p;
    return {
      id: uid(),
      sku: `SEED-${String(i).padStart(3, '0')}`,
      categoryId: catId(slug),
      description: null,
      cost: 0,
      imageUrl: null,
      allowsSpice: Boolean(allowsSpice),
      allowsPlaRa: false,
      allowsProtein: false,
      isAvailable: true,
      isActive: true,
      trackInventory: false,
      stockQty: 0,
      reorderLevel: 0,
      sortOrder: i,
      defaultSpice: allowsSpice ? 'MEDIUM' : 'NONE',
      optionGroupIds: groupIds || [],
      ...rest,
    };
  });

  const customers = [
    {
      id: uid(), phone: '0812345678', fullName: 'พลอย รักดี', email: null, tierId: memberTier.id,
      pointsBalance: 120, lifetimePoints: 320, visitCount: 8, lifetimeSpend: 3200,
      isActive: true, createdAt: now, updatedAt: now,
    },
    {
      id: uid(), phone: '0899999999', fullName: 'กฤต แซ่บเลิฟเวอร์', email: null, tierId: goldTier.id,
      pointsBalance: 640, lifetimePoints: 2450, visitCount: 41, lifetimeSpend: 24500,
      isActive: true, createdAt: now, updatedAt: now,
    },
  ];

  return {
    version: 1,
    users, tiers, loyaltyConfig, categories, optionGroups, products,
    customers, loyaltyTransactions: [], orders: [], stockMovements: [],
    nextOrderNumber: 1,
  };
}

/* ------------------------------ Persistence ------------------------------ */

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt/blocked storage — fall through to a fresh seed
  }
  const fresh = seedData();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  } catch {
    // storage unavailable (private mode, quota) — app still works for this tab
  }
  return fresh;
}

const data = load();

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch {
    // ignore — best effort only
  }
}

function setSession(userId) {
  try {
    localStorage.setItem(SESSION_KEY, userId);
  } catch {
    // ignore
  }
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

const stripPassword = ({ password, ...rest }) => rest;

function allOptions() {
  return data.optionGroups.flatMap((g) => g.options);
}

function attachProductRelations(p) {
  const category = data.categories.find((c) => c.id === p.categoryId);
  const optionGroups = (p.optionGroupIds || [])
    .map((gid) => data.optionGroups.find((g) => g.id === gid))
    .filter(Boolean)
    .map((optionGroup) => ({ productId: p.id, optionGroupId: optionGroup.id, optionGroup }));
  return {
    ...p,
    category: category ? { name: category.name, nameTh: category.nameTh, slug: category.slug, color: category.color } : null,
    optionGroups,
  };
}

function attachCustomerTier(c) {
  return { ...c, tier: data.tiers.find((t) => t.id === c.tierId) || null };
}

function attachCustomerDetail(c, { withOrders = false } = {}) {
  const loyaltyTransactions = data.loyaltyTransactions
    .filter((t) => t.customerId === c.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);
  const base = { ...attachCustomerTier(c), loyaltyTransactions };
  if (!withOrders) return base;
  const orders = data.orders
    .filter((o) => o.customerId === c.id)
    .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
    .slice(0, 10)
    .map((o) => ({ id: o.id, orderNumber: o.orderNumber, total: o.total, placedAt: o.placedAt, status: o.status }));
  return { ...base, orders };
}

function rangeFor(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === 'week') start.setDate(now.getDate() - 6);
  else if (period === 'month') start.setDate(now.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

/* ---------------------------------- API ---------------------------------- */

export const db = {
  /* ---- auth ---- */
  login(username, password) {
    const u = data.users.find((x) => x.username === username);
    if (!u || !u.isActive || u.password !== password) {
      throw new ApiError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    }
    u.lastLoginAt = nowIso();
    persist();
    setSession(u.id);
    return stripPassword(u);
  },
  logout() {
    clearSession();
  },
  getSessionUser() {
    const id = readSession();
    if (!id) return null;
    const u = data.users.find((x) => x.id === id && x.isActive);
    return u ? stripPassword(u) : null;
  },

  /* ---- menu ---- */
  getCategories() {
    return [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  },
  getProducts({ includeInactive = false } = {}) {
    return data.products
      .filter((p) => includeInactive || p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(attachProductRelations);
  },
  createProduct(payload) {
    const p = {
      id: uid(),
      sku: payload.sku || `LOCAL-${uid().slice(0, 8)}`,
      isActive: true,
      optionGroupIds: [],
      ...payload,
    };
    data.products.push(p);
    persist();
    return attachProductRelations(p);
  },
  updateProduct(id, payload) {
    const p = data.products.find((x) => x.id === id);
    if (!p) throw new ApiError('ไม่พบสินค้า', 404);
    Object.assign(p, payload);
    persist();
    return attachProductRelations(p);
  },
  deactivateProduct(id) {
    const p = data.products.find((x) => x.id === id);
    if (!p) throw new ApiError('ไม่พบสินค้า', 404);
    p.isActive = false;
    persist();
  },
  setProductAvailability(id, isAvailable) {
    const p = data.products.find((x) => x.id === id);
    if (!p) throw new ApiError('ไม่พบสินค้า', 404);
    p.isAvailable = isAvailable;
    persist();
    return attachProductRelations(p);
  },

  /* ---- inventory ---- */
  getInventory() {
    return data.products
      .filter((p) => p.trackInventory && p.isActive)
      .sort((a, b) => Number(a.stockQty) - Number(b.stockQty))
      .map(attachProductRelations);
  },
  recordStockMovement(productId, { type, quantity, note }) {
    const p = data.products.find((x) => x.id === productId);
    if (!p) throw new ApiError('ไม่พบสินค้า', 404);
    const delta = type === 'WASTE' ? -Math.abs(quantity) : quantity;
    const balanceAfter = Number(p.stockQty) + delta;
    p.stockQty = balanceAfter;
    const movement = {
      id: uid(), productId, type, quantity: delta, balanceAfter,
      note: note || null, orderId: null, createdById: db.getSessionUser()?.id ?? null, createdAt: nowIso(),
    };
    data.stockMovements.push(movement);
    persist();
    return movement;
  },

  /* ---- customers / loyalty ---- */
  searchCustomers(q) {
    const query = (q || '').trim().toLowerCase();
    return data.customers
      .filter((c) => !query || c.phone.includes(query) || (c.fullName || '').toLowerCase().includes(query))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 50)
      .map(attachCustomerTier);
  },
  lookupCustomerByPhone(phone) {
    const p = (phone || '').trim();
    if (!p) throw new ApiError('กรุณาระบุเบอร์โทรศัพท์', 400);
    const c = data.customers.find((x) => x.phone === p);
    if (!c) throw new ApiError('ไม่พบสมาชิกที่ใช้เบอร์โทรนี้', 404);
    return attachCustomerDetail(c);
  },
  getCustomer(id) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) throw new ApiError('ไม่พบสมาชิก', 404);
    return attachCustomerDetail(c, { withOrders: true });
  },
  createCustomer({ phone, fullName }) {
    const baseTier = resolveTier(0, data.tiers);
    const c = {
      id: uid(), phone: String(phone || '').trim(), fullName: fullName || null, email: null,
      tierId: baseTier?.id ?? null, pointsBalance: 0, lifetimePoints: 0,
      visitCount: 0, lifetimeSpend: 0, isActive: true, createdAt: nowIso(), updatedAt: nowIso(),
    };
    data.customers.push(c);
    persist();
    return attachCustomerDetail(c);
  },
  adjustCustomerPoints(id, points, note) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) throw new ApiError('ไม่พบสมาชิก', 404);
    const balanceAfter = Math.max(0, c.pointsBalance + points);
    data.loyaltyTransactions.push({
      id: uid(), customerId: c.id, orderId: null, type: 'ADJUST', points,
      balanceAfter, note, createdById: db.getSessionUser()?.id ?? null, createdAt: nowIso(),
    });
    c.pointsBalance = balanceAfter;
    if (points > 0) c.lifetimePoints += points;
    c.updatedAt = nowIso();
    persist();
    return attachCustomerDetail(c, { withOrders: true });
  },
  getLoyaltyConfig() {
    return { ...data.loyaltyConfig };
  },

  /* ---- tiers ---- */
  getTiers() {
    return [...data.tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /* ---- checkout ---- */
  checkout({ items, customerId, manualDiscount = 0, pointsToRedeem = 0, payments }) {
    const actingUser = db.getSessionUser();
    const productIds = new Set(items.map((i) => i.productId));
    const productMap = new Map(data.products.filter((p) => productIds.has(p.id)).map((p) => [p.id, p]));
    const optionMap = new Map(allOptions().map((o) => [o.id, o]));
    const customer = customerId ? data.customers.find((c) => c.id === customerId) : null;

    const lines = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new ApiError(`ไม่พบสินค้า ${item.productId}`, 422);
      if (!product.isAvailable || !product.isActive) {
        throw new ApiError(`"${product.nameTh || product.name}" ไม่พร้อมจำหน่าย`, 409);
      }
      const selectedOptions = (item.optionIds || []).map((id) => {
        const opt = optionMap.get(id);
        if (!opt) throw new ApiError(`ไม่พบตัวเลือก ${id}`, 422);
        return opt;
      });
      const optionsTotal = round2(selectedOptions.reduce((s, o) => s + Number(o.priceDelta), 0));
      const unitPrice = Number(product.price);
      return {
        product, item, selectedOptions, unitPrice, optionsTotal,
        quantity: item.quantity,
        lineTotal: lineTotal({ unitPrice, optionsTotal, quantity: item.quantity }),
      };
    });

    if (customer && pointsToRedeem > customer.pointsBalance) {
      throw new ApiError('สมาชิกมีแต้มสะสมไม่เพียงพอสำหรับการแลก', 409);
    }

    const tier = customer?.tierId ? data.tiers.find((t) => t.id === customer.tierId) : null;
    const bill = buildBill(lines, {
      manualDiscount,
      tierDiscountPct: tier ? Number(tier.discountPercent) : 0,
      pointsToRedeem: customer ? pointsToRedeem : 0,
      loyaltyConfig: data.loyaltyConfig,
      pointsMultiplier: tier ? Number(tier.pointsMultiplier) : 1,
    });

    const paidTotal = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (paidTotal + 0.01 < bill.total) {
      throw new ApiError(`ยอดชำระ (${paidTotal}) น้อยกว่ายอดที่ต้องชำระ (${bill.total})`, 422);
    }

    const now = nowIso();
    const order = {
      id: uid(),
      orderNumber: data.nextOrderNumber++,
      cashierId: actingUser?.id ?? null,
      customerId: customer?.id ?? null,
      status: 'COMPLETED', // no kitchen-display workflow on a single-device setup
      orderType: 'DINE_IN',
      tableLabel: null,
      note: null,
      subtotal: bill.subtotal, discountAmount: bill.discountAmount, tierDiscount: bill.tierDiscount,
      pointsRedeemed: bill.pointsRedeemed, pointsValue: bill.pointsValue,
      taxAmount: bill.taxAmount, serviceCharge: bill.serviceCharge, total: bill.total,
      pointsEarned: bill.pointsEarned, paymentStatus: 'PAID',
      placedAt: now, completedAt: now,
      items: lines.map((l) => ({
        id: uid(), productId: l.product.id, nameSnapshot: l.product.nameTh || l.product.name,
        unitPrice: l.unitPrice, quantity: l.quantity,
        spiceLevel: l.item.spiceLevel || l.product.defaultSpice, plaRa: l.item.plaRa ?? false,
        optionsTotal: l.optionsTotal, lineTotal: l.lineTotal, note: l.item.note || null,
        options: l.selectedOptions.map((o) => ({ id: uid(), optionId: o.id, nameSnapshot: o.nameTh || o.name, priceDelta: o.priceDelta })),
      })),
      transactions: payments.map((p) => ({
        id: uid(), method: p.method, amount: p.amount, tendered: p.tendered ?? null,
        changeGiven: p.method === 'CASH' && p.tendered ? round2(Math.max(0, p.tendered - p.amount)) : 0,
        reference: p.reference || null, status: 'PAID', processedById: actingUser?.id ?? null, processedAt: now,
      })),
    };
    data.orders.push(order);

    for (const l of lines) {
      if (l.product.trackInventory) {
        const balanceAfter = Number(l.product.stockQty) - l.quantity;
        l.product.stockQty = balanceAfter;
        data.stockMovements.push({
          id: uid(), productId: l.product.id, type: 'SALE', quantity: -l.quantity,
          balanceAfter, note: null, orderId: order.id, createdById: actingUser?.id ?? null, createdAt: now,
        });
      }
    }

    if (customer) {
      let balance = customer.pointsBalance;
      if (bill.pointsRedeemed > 0) {
        balance -= bill.pointsRedeemed;
        data.loyaltyTransactions.push({
          id: uid(), customerId: customer.id, orderId: order.id, type: 'REDEEM',
          points: -bill.pointsRedeemed, balanceAfter: balance,
          note: `ใช้แต้มในออเดอร์ #${order.orderNumber}`, createdById: actingUser?.id ?? null, createdAt: now,
        });
      }
      if (bill.pointsEarned > 0) {
        balance += bill.pointsEarned;
        data.loyaltyTransactions.push({
          id: uid(), customerId: customer.id, orderId: order.id, type: 'EARN',
          points: bill.pointsEarned, balanceAfter: balance,
          note: `สะสมแต้มจากออเดอร์ #${order.orderNumber}`, createdById: actingUser?.id ?? null, createdAt: now,
        });
      }
      customer.pointsBalance = balance;
      customer.lifetimePoints += bill.pointsEarned;
      const newTier = resolveTier(customer.lifetimePoints, data.tiers);
      customer.tierId = newTier?.id ?? customer.tierId;
      customer.lifetimeSpend += bill.total;
      customer.visitCount += 1;
      customer.updatedAt = now;
    }

    persist();
    return { order, bill };
  },

  /* ---- reports ---- */
  getDashboardReport(period = 'week') {
    const { start, end } = rangeFor(period);
    const completed = data.orders.filter(
      (o) => o.status === 'COMPLETED' && o.completedAt && new Date(o.completedAt) >= start && new Date(o.completedAt) <= end,
    );

    const grossSales = round2(completed.reduce((s, o) => s + Number(o.total), 0));
    const orderCount = completed.length;
    const avgOrderValue = round2(orderCount ? grossSales / orderCount : 0);
    const discountsGiven = round2(completed.reduce((s, o) => s + Number(o.discountAmount) + Number(o.pointsValue), 0));
    const pointsIssued = completed.reduce((s, o) => s + Number(o.pointsEarned), 0);
    const activeMembers = data.customers.filter((c) => c.isActive !== false).length;

    const buckets = new Map();
    for (const o of completed) {
      const key = o.completedAt.slice(0, 10);
      buckets.set(key, (buckets.get(key) || 0) + Number(o.total));
    }
    const series = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, revenue: round2(buckets.get(key) || 0) });
    }

    const itemAgg = new Map();
    for (const o of completed) {
      for (const it of o.items) {
        const cur = itemAgg.get(it.productId) || { productId: it.productId, name: it.nameSnapshot, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue = round2(cur.revenue + Number(it.lineTotal));
        itemAgg.set(it.productId, cur);
      }
    }
    const bestSellers = [...itemAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

    const payAgg = new Map();
    for (const o of completed) {
      for (const t of o.transactions) {
        if (t.status !== 'PAID') continue;
        const cur = payAgg.get(t.method) || { method: t.method, amount: 0, count: 0 };
        cur.amount = round2(cur.amount + Number(t.amount));
        cur.count += 1;
        payAgg.set(t.method, cur);
      }
    }

    const lowStock = data.products.filter((p) => p.trackInventory && p.isActive && Number(p.stockQty) <= Number(p.reorderLevel));

    return {
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      kpis: { grossSales, orderCount, avgOrderValue, discountsGiven, pointsIssued, activeMembers },
      revenueSeries: series,
      bestSellers,
      paymentBreakdown: [...payAgg.values()],
      lowStock,
    };
  },
  getSalesReport({ groupBy = 'day', period = 'month' } = {}) {
    const { start, end } = rangeFor(period);
    const completed = data.orders.filter(
      (o) => o.status === 'COMPLETED' && o.completedAt && new Date(o.completedAt) >= start && new Date(o.completedAt) <= end,
    );

    const bucketKey = (dateStr) => {
      const d = new Date(dateStr);
      if (groupBy === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      if (groupBy === 'week') {
        const dayOffset = (d.getDay() + 6) % 7; // Monday = 0
        const monday = new Date(d);
        monday.setDate(d.getDate() - dayOffset);
        monday.setHours(0, 0, 0, 0);
        return monday.toISOString();
      }
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.toISOString();
    };

    const buckets = new Map();
    for (const o of completed) {
      const key = bucketKey(o.completedAt);
      const cur = buckets.get(key) || { bucket: key, orders: 0, gross_sales: 0, discounts: 0, points_issued: 0 };
      cur.orders += 1;
      cur.gross_sales = round2(cur.gross_sales + Number(o.total));
      cur.discounts = round2(cur.discounts + Number(o.discountAmount));
      cur.points_issued += Number(o.pointsEarned);
      buckets.set(key, cur);
    }
    return [...buckets.values()].sort((a, b) => new Date(b.bucket) - new Date(a.bucket));
  },

  /* ---- staff ---- */
  getUsers() {
    return [...data.users].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(stripPassword);
  },
  createUser(form) {
    if (data.users.some((u) => u.username === form.username)) {
      throw new ApiError('มีชื่อผู้ใช้นี้อยู่แล้ว', 409);
    }
    const u = {
      id: uid(), username: form.username, fullName: form.fullName,
      email: form.email || null, role: form.role, password: form.password,
      isActive: true, lastLoginAt: null, createdAt: nowIso(),
    };
    data.users.push(u);
    persist();
    return stripPassword(u);
  },
  updateUser(id, patch) {
    const u = data.users.find((x) => x.id === id);
    if (!u) throw new ApiError('ไม่พบผู้ใช้งาน', 404);
    const { password, ...rest } = patch;
    Object.assign(u, rest);
    if (password) u.password = password;
    persist();
    return stripPassword(u);
  },
  deactivateUser(id) {
    const current = db.getSessionUser();
    if (current && current.id === id) throw new ApiError('ไม่สามารถปิดการใช้งานบัญชีของตนเองได้', 400);
    const u = data.users.find((x) => x.id === id);
    if (!u) throw new ApiError('ไม่พบผู้ใช้งาน', 404);
    u.isActive = false;
    persist();
  },
};
