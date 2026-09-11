import { test, expect, fieldFor, modalRoot } from '../support/fixtures.js';

test.describe('Admin: staff management', () => {
  test('a new cashier can be created, edited and deactivated', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.getByRole('link', { name: 'พนักงาน' }).click();
    await expect(page).toHaveURL(/\/admin\/staff/);

    const username = `e2e_${Date.now()}`;
    const fullName = 'พนักงานทดสอบ E2E';

    await page.getByRole('button', { name: '+ เพิ่มพนักงาน' }).click();
    let modal = modalRoot(page);
    await fieldFor(modal, 'ชื่อ-นามสกุล').fill(fullName);
    await fieldFor(modal, 'ชื่อผู้ใช้').fill(username);
    await fieldFor(modal, 'รหัสผ่าน').fill('password123');
    // CASHIER is selected by default; leave it as-is.
    await modal.getByRole('button', { name: 'บันทึก' }).click();

    const row = page.locator('tr', { hasText: username });
    await expect(row).toBeVisible();
    await expect(row.getByText('แคชเชียร์')).toBeVisible();
    await expect(row.getByText('ใช้งาน', { exact: true })).toBeVisible();

    // Edit the display name.
    await row.getByRole('button', { name: 'แก้ไข' }).click();
    modal = modalRoot(page);
    const newName = `${fullName} (แก้ไขแล้ว)`;
    await fieldFor(modal, 'ชื่อ-นามสกุล').fill(newName);
    await modal.getByRole('button', { name: 'บันทึก' }).click();
    await expect(page.locator('tr', { hasText: username })).toContainText(newName);

    // Deactivate — the row dims and its status flips to "ปิดใช้งาน".
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tr', { hasText: username }).getByRole('button', { name: 'ปิดการใช้งาน' }).click();
    await expect(page.locator('tr', { hasText: username })).toContainText('ปิดใช้งาน');
  });
});
