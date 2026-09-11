import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌶️  Seeding Yam Zabb POS...');

  /* ------------------------------- Staff -------------------------------- */
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', fullName: 'สมชาย (เจ้าของร้าน)', role: 'ADMIN', passwordHash, email: 'admin@yamzabb.local' },
  });
  await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {},
    create: { username: 'cashier', fullName: 'นก (แคชเชียร์)', role: 'CASHIER', passwordHash },
  });

  /* --------------------------- Membership tiers ------------------------- */
  const tierData = [
    { name: 'Member', minPoints: 0, discountPercent: 0, pointsMultiplier: 1.0, color: '#9ca3af', sortOrder: 0 },
    { name: 'Silver', minPoints: 500, discountPercent: 5, pointsMultiplier: 1.0, color: '#94a3b8', sortOrder: 1 },
    { name: 'Gold', minPoints: 2000, discountPercent: 10, pointsMultiplier: 1.25, color: '#eab308', sortOrder: 2 },
    { name: 'Zabb Master', minPoints: 5000, discountPercent: 15, pointsMultiplier: 1.5, color: '#dc2626', sortOrder: 3 },
  ];
  for (const t of tierData) {
    await prisma.membershipTier.upsert({ where: { name: t.name }, update: t, create: t });
  }
  const memberTier = await prisma.membershipTier.findUnique({ where: { name: 'Member' } });
  const goldTier = await prisma.membershipTier.findUnique({ where: { name: 'Gold' } });

  await prisma.loyaltyConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, pointsPerCurrency: 0.1, currencyPerPoint: 1, minRedeemPoints: 50, maxRedeemPercent: 50 },
  });

  /* ----------------------------- Categories ---------------------------- */
  const categories = [
    { name: 'Yam / Spicy Salads', nameTh: 'ยำแซ่บ', slug: 'yam', color: '#dc2626', icon: '🥗', sortOrder: 0 },
    { name: 'Som Tam', nameTh: 'ส้มตำ', slug: 'som-tam', color: '#16a34a', icon: '🥭', sortOrder: 1 },
    { name: 'Grilled & Larb', nameTh: 'ย่าง / ลาบ', slug: 'grilled', color: '#ea580c', icon: '🍢', sortOrder: 2 },
    { name: 'Sides & Sticky Rice', nameTh: 'ของทานเล่น', slug: 'sides', color: '#ca8a04', icon: '🍚', sortOrder: 3 },
    { name: 'Drinks', nameTh: 'เครื่องดื่ม', slug: 'drinks', color: '#0891b2', icon: '🥤', sortOrder: 4 },
    { name: 'Toppings & Add-ons', nameTh: 'เพิ่มเติม', slug: 'toppings', color: '#7c3aed', icon: '➕', sortOrder: 5 },
  ];
  const catMap = {};
  for (const c of categories) {
    catMap[c.slug] = await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }

  /* --------------------------- Option groups --------------------------- */
  // Neither OptionGroup nor Option has a natural unique key, so upsert
  // manually by name to keep re-running this script idempotent.
  async function upsertOptionGroup(fields, optionDefs) {
    const existingGroup = await prisma.optionGroup.findFirst({ where: { name: fields.name } });
    const group = existingGroup
      ? await prisma.optionGroup.update({ where: { id: existingGroup.id }, data: fields })
      : await prisma.optionGroup.create({ data: fields });
    const options = [];
    for (const o of optionDefs) {
      const existing = await prisma.option.findFirst({ where: { optionGroupId: group.id, name: o.name } });
      const option = existing
        ? await prisma.option.update({ where: { id: existing.id }, data: o })
        : await prisma.option.create({ data: { ...o, optionGroupId: group.id } });
      options.push(option);
    }
    return { ...group, options };
  }

  const proteinGroup = await upsertOptionGroup(
    { name: 'Protein / Seafood', nameTh: 'เลือกโปรตีน', minSelect: 1, maxSelect: 1, isRequired: true, sortOrder: 0 },
    [
      { name: 'Minced pork', nameTh: 'หมูสับ', priceDelta: 0, sortOrder: 0 },
      { name: 'Sliced chicken', nameTh: 'ไก่ฉีก', priceDelta: 0, sortOrder: 1 },
      { name: 'Shrimp', nameTh: 'กุ้ง', priceDelta: 30, sortOrder: 2 },
      { name: 'Squid', nameTh: 'ปลาหมึก', priceDelta: 30, sortOrder: 3 },
      { name: 'Mixed seafood', nameTh: 'ทะเลรวม', priceDelta: 50, sortOrder: 4 },
      { name: 'Crispy pork', nameTh: 'หมูกรอบ', priceDelta: 20, sortOrder: 5 },
    ],
  );
  const addonGroup = await upsertOptionGroup(
    { name: 'Extra toppings', nameTh: 'เพิ่มท็อปปิ้ง', minSelect: 0, maxSelect: 5, isRequired: false, sortOrder: 1 },
    [
      { name: 'Salted egg', nameTh: 'ไข่เค็ม', priceDelta: 15 },
      { name: 'Century egg', nameTh: 'ไข่เยี่ยวม้า', priceDelta: 15 },
      { name: 'Extra peanuts', nameTh: 'ถั่วเพิ่ม', priceDelta: 10 },
      { name: 'Crispy shallots', nameTh: 'หอมเจียว', priceDelta: 10 },
      { name: 'Vermicelli', nameTh: 'วุ้นเส้น', priceDelta: 20 },
    ],
  );

  /* ------------------------------ Products ----------------------------- */
  const products = [
    // Yam
    { slug: 'yam', name: 'Yam Woon Sen', nameTh: 'ยำวุ้นเส้น', price: 89, allowsSpice: true, allowsPlaRa: true, allowsProtein: true, groups: [proteinGroup, addonGroup] },
    { slug: 'yam', name: 'Yam Talay (Seafood)', nameTh: 'ยำทะเล', price: 149, allowsSpice: true, allowsPlaRa: true },
    { slug: 'yam', name: 'Yam Mama Noodle', nameTh: 'ยำมาม่า', price: 79, allowsSpice: true, allowsPlaRa: true, allowsProtein: true, groups: [proteinGroup, addonGroup] },
    { slug: 'yam', name: 'Yam Khai Dao (Fried Egg Salad)', nameTh: 'ยำไข่ดาว', price: 69, allowsSpice: true },
    { slug: 'yam', name: 'Pla Duk Foo (Crispy Catfish Salad)', nameTh: 'ยำปลาดุกฟู', price: 129, allowsSpice: true },
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

  for (const [i, p] of products.entries()) {
    const { slug, groups, ...data } = p;
    const sku = `SEED-${String(i).padStart(3, '0')}`;
    const fields = {
      ...data,
      categoryId: catMap[slug].id,
      defaultSpice: data.allowsSpice ? 'MEDIUM' : 'NONE',
      sortOrder: i,
    };
    const created = await prisma.product.upsert({
      where: { sku },
      update: fields,
      create: { ...fields, sku },
    });
    for (const g of groups || []) {
      await prisma.productOptionGroup.upsert({
        where: { productId_optionGroupId: { productId: created.id, optionGroupId: g.id } },
        update: {},
        create: { productId: created.id, optionGroupId: g.id },
      });
    }
  }

  /* ----------------------------- Customers ----------------------------- */
  await prisma.customer.upsert({
    where: { phone: '0812345678' },
    update: {},
    create: {
      phone: '0812345678', fullName: 'พลอย รักดี', tierId: memberTier.id,
      pointsBalance: 120, lifetimePoints: 320, visitCount: 8, lifetimeSpend: 3200,
    },
  });
  await prisma.customer.upsert({
    where: { phone: '0899999999' },
    update: {},
    create: {
      phone: '0899999999', fullName: 'กฤต แซ่บเลิฟเวอร์', tierId: goldTier.id,
      pointsBalance: 640, lifetimePoints: 2450, visitCount: 41, lifetimeSpend: 24500,
    },
  });

  console.log('✅ Seed complete.');
  console.log('   Admin login:   admin / password123');
  console.log('   Cashier login: cashier / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
