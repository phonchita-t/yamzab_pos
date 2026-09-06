/**
 * Bill / loyalty math for Yam Zabb POS.
 * All monetary values are plain JS numbers (THB, 2dp) inside this module;
 * callers persist them with Prisma Decimal columns.
 */

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute a single line total from a base price, selected options and quantity.
 */
export function lineTotal({ unitPrice, optionsTotal = 0, quantity }) {
  return round2((Number(unitPrice) + Number(optionsTotal)) * quantity);
}

/**
 * Build the full bill summary.
 *
 * @param {object[]} items          - [{ unitPrice, optionsTotal, quantity }]
 * @param {object}   opts
 * @param {number}   opts.manualDiscount   - flat THB discount entered by cashier
 * @param {number}   opts.tierDiscountPct  - membership tier percent (0-100)
 * @param {number}   opts.pointsToRedeem   - loyalty points the customer spends
 * @param {object}   opts.loyaltyConfig    - { pointsPerCurrency, currencyPerPoint, minRedeemPoints, maxRedeemPercent }
 * @param {number}   opts.pointsMultiplier - tier earn multiplier
 * @param {number}   opts.taxRate          - e.g. 0.07, default 0
 * @param {number}   opts.serviceChargeRate- e.g. 0.10, default 0
 */
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

  // Points redemption, capped by config and available balance handled by caller.
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

  return {
    subtotal,
    tierDiscount,
    discountAmount,
    pointsRedeemed,
    pointsValue,
    taxAmount,
    serviceCharge,
    total,
    pointsEarned,
  };
}

/**
 * Given lifetime points and a list of tiers, return the tier the customer
 * currently qualifies for (highest minPoints not exceeding lifetimePoints).
 */
export function resolveTier(lifetimePoints, tiers) {
  return [...tiers]
    .filter((t) => lifetimePoints >= t.minPoints)
    .sort((a, b) => b.minPoints - a.minPoints)[0] || null;
}
