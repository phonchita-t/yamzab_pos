import { test, expect } from '../support/fixtures.js';

/**
 * End-to-end happy path: cashier rings up a simple (no-customisation) item
 * and pays exact cash. The app is single-device / client-only, so the order
 * is recorded straight to localStorage — there's no separate kitchen display
 * to hand it off to.
 */
test.describe('POS checkout', () => {
  test('cash sale of a simple item completes with a receipt', async ({ page, loginAsCashier }) => {
    await loginAsCashier();

    // "Kai Yang (Grilled Chicken) 1/2" has no spice/pla-ra/option choices,
    // so tapping the tile adds it straight to the cart.
    await page.getByRole('button', { name: /ไก่ย่างครึ่งตัว/ }).click();
    await expect(page.locator('aside').getByText('ไก่ย่างครึ่งตัว')).toBeVisible();

    await page.getByRole('button', { name: /^คิดเงิน/ }).click();
    await expect(page.getByRole('heading', { name: 'ชำระเงิน' })).toBeVisible();

    // Cash is the default method — "พอดี" auto-fills the exact bill total.
    await page.getByRole('button', { name: 'พอดี' }).click();
    await page.getByRole('button', { name: /ยืนยันการชำระเงิน/ }).click();

    // Receipt screen.
    await expect(page.getByText(/ชำระเงินแล้ว/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /ออเดอร์ #(\d+)/ })).toBeVisible();

    await page.getByRole('button', { name: 'ออเดอร์ใหม่' }).click();
  });
});
