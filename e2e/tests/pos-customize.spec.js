import { test, expect, modalRoot } from '../support/fixtures.js';

test.describe('Item customisation modal', () => {
  test('a required protein choice, spice level and Pla Ra note reach the cart line', async ({
    page,
    loginAsCashier,
  }) => {
    await loginAsCashier();

    // "Yam Woon Sen" requires a protein pick before it can be added.
    await page.getByRole('button', { name: /ยำวุ้นเส้น/ }).click();
    const modal = modalRoot(page);
    const addButton = modal.getByRole('button', { name: 'เพิ่มลงออเดอร์' });
    await expect(addButton).toBeDisabled();

    await modal.getByRole('button', { name: 'เผ็ดมาก' }).click();
    // The Pla Ra switch is an unlabelled toggle button next to its description.
    await modal
      .locator('section', { hasText: 'เพิ่มปลาร้าในเมนูนี้' })
      .getByRole('button')
      .click();
    await modal.getByRole('button', { name: /กุ้ง/ }).click(); // protein option (+30)
    await modal.getByPlaceholder('เช่น ไม่ใส่ถั่ว เพิ่มมะนาว แยกน้ำจิ้ม').fill('ไม่ใส่แตงกวา');

    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(page.locator('aside').getByText('+ ปลาร้า')).toBeVisible();
    await expect(page.locator('aside').getByText('กุ้ง')).toBeVisible();
    await expect(page.locator('aside').getByText('ไม่ใส่แตงกวา')).toBeVisible();
  });
});
