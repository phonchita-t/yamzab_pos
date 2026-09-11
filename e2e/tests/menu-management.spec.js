import { test, expect, fieldFor, modalRoot } from '../support/fixtures.js';

test.describe('Admin: menu management', () => {
  test("a new product can be created, edited and 86'd", async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.getByRole('link', { name: 'จัดการเมนู' }).click();
    await expect(page).toHaveURL(/\/admin\/menu/);

    const productName = `เมนูทดสอบ E2E ${Date.now()}`;

    await page.getByRole('button', { name: '+ เพิ่มเมนู' }).click();
    let modal = modalRoot(page);
    await fieldFor(modal, 'ชื่อ (ไทย)').fill(productName);
    await fieldFor(modal, 'ราคาขาย (฿)').fill('59');
    await modal.getByRole('button', { name: 'บันทึก' }).click();

    const row = page.locator('tr', { hasText: productName });
    await expect(row).toBeVisible();
    await expect(row.getByText(/59/)).toBeVisible();
    await expect(row.getByRole('button', { name: 'พร้อมจำหน่าย' })).toBeVisible();

    // Quick 86 / un-86 toggle.
    await row.getByRole('button', { name: 'พร้อมจำหน่าย' }).click();
    await expect(row.getByRole('button', { name: 'ของหมด' })).toBeVisible();

    // Edit the price.
    await row.getByRole('button', { name: 'แก้ไข' }).click();
    modal = modalRoot(page);
    await fieldFor(modal, 'ราคาขาย (฿)').fill('65');
    await modal.getByRole('button', { name: 'บันทึก' }).click();
    await expect(row.getByText(/65/)).toBeVisible();
  });
});
