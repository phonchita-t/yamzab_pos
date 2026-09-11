import { test, expect, fieldFor, modalRoot } from '../support/fixtures.js';

test.describe('Admin: inventory movements', () => {
  test('recording a stock purchase increases the tracked quantity', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.getByRole('link', { name: 'คลังสินค้า' }).click();
    await expect(page).toHaveURL(/\/admin\/inventory/);

    const row = page.locator('tr', { hasText: 'ข้าวเหนียว' });
    await expect(row).toBeVisible();
    const before = Number((await row.locator('td').nth(2).textContent()).trim());

    await row.getByRole('button', { name: 'ปรับยอด' }).click();
    const modal = modalRoot(page);
    await expect(modal.getByRole('heading', { name: /ปรับยอด/ })).toBeVisible();

    await modal.getByRole('button', { name: 'รับเข้า' }).click();
    await fieldFor(modal, 'จำนวน (เพิ่มเข้า)').fill('10');
    await fieldFor(modal, 'หมายเหตุ').fill('E2E test restock');
    await modal.getByRole('button', { name: 'บันทึกรายการ' }).click();

    await expect(row.locator('td').nth(2)).toHaveText(String(before + 10));
  });
});
