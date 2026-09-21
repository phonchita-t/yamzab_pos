// Bill + loyalty math. Ported from the old server (server/src/lib/pricing.js)
// so the checkout preview and the committed order always agree — both now
// call this same code from client/src/lib/store.js.

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal({ unitPrice, optionsTotal = 0, quantity }) {
  return round2((Number(unitPrice) + Number(optionsTotal)) * quantity);
}

export function buildBill(items, opts = {}) {
  const {
    manualDiscount = 0,
    tierDiscountPct = 0,
    pointsToRedeem = 0,
    loyaltyConfig = { pointsPerCurrency: 0.1, currencyPerPoint: 1, minRedeemPoints: 50, maxRedeemPercent: 50 },
    pointsMultiplier = 1,
    taxRate = 0,
    serviceChargeRate = 0,
  } = opts;

  const subtotal = round2(items.reduce((sum, it) => sum + lineTotal(it), 0));
  const tierDiscount = round2((subtotal * tierDiscountPct) / 100);
  const discountAmount = round2(Math.min(manualDiscount + tierDiscount, subtotal));
  const afterDiscount = round2(subtotal - discountAmount);

  const currencyPerPoint = Number(loyaltyConfig.currencyPerPoint) || 1;
  const maxRedeemValue = round2((afterDiscount * Number(loyaltyConfig.maxRedeemPercent)) / 100);
  let pointsRedeemed = Math.max(0, Math.floor(pointsToRedeem));
  if (pointsRedeemed > 0 && pointsRedeemed < Number(loyaltyConfig.minRedeemPoints)) {
    pointsRedeemed = 0;
  }
  let pointsValue = round2(pointsRedeemed * currencyPerPoint);
  if (pointsValue > maxRedeemValue) {
    pointsValue = maxRedeemValue;
    pointsRedeemed = Math.floor(pointsValue / currencyPerPoint);
    pointsValue = round2(pointsRedeemed * currencyPerPoint);
  }

  const taxable = round2(afterDiscount - pointsValue);
  const taxAmount = round2(taxable * taxRate);
  const serviceCharge = round2(taxable * serviceChargeRate);
  const total = round2(taxable + taxAmount + serviceCharge);
  const pointsEarned = Math.floor(total * Number(loyaltyConfig.pointsPerCurrency) * pointsMultiplier);

  return { subtotal, tierDiscount, discountAmount, pointsRedeemed, pointsValue, taxAmount, serviceCharge, total, pointsEarned };
}

export function resolveTier(lifetimePoints, tiers) {
  return [...tiers]
    .filter((t) => lifetimePoints >= t.minPoints)
    .sort((a, b) => b.minPoints - a.minPoints)[0] || null;
}
