import { test, expect } from '../support/fixtures.js';

/**
 * End-to-end happy path: cashier rings up a simple (no-customisation) item,
 * pays exact cash, and the order shows up on the Kitchen Display System and
 * can be walked through its full status lifecycle.
 */
test.describe('POS checkout -> KDS lifecycle', () => {
  test('cash sale of a simple item flows through to KDS completion', async ({ page, loginAsCashier }) => {
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
    const orderHeading = page.getByRole('heading', { name: /ออเดอร์ #(\d+)/ });
    await expect(orderHeading).toBeVisible();
    const orderNumber = (await orderHeading.textContent()).match(/#(\d+)/)[1];

    await page.getByRole('button', { name: 'ออเดอร์ใหม่' }).click();

    // Kitchen display: the new order starts in "PENDING".
    await page.goto('/kds');
    const ticket = page.locator('article', { hasText: `#${orderNumber}` });
    await expect(ticket).toBeVisible();
    await expect(ticket.getByText('ไก่ย่างครึ่งตัว')).toBeVisible();

    await ticket.getByRole('button', { name: 'เริ่มปรุง →' }).click();
    await expect(ticket.getByRole('button', { name: 'ปรุงเสร็จแล้ว ✓' })).toBeVisible();

    await ticket.getByRole('button', { name: 'ปรุงเสร็จแล้ว ✓' }).click();
    await expect(ticket.getByRole('button')).toHaveCount(0);
  });
});
