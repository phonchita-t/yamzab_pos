import { test, expect, DEMO, modalRoot } from '../support/fixtures.js';

test.describe('Admin: member loyalty adjustment', () => {
  test('a manual point adjustment updates the balance and ledger', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.getByRole('link', { name: 'สมาชิก' }).click();
    await expect(page).toHaveURL(/\/admin\/members/);

    await page.getByPlaceholder('ค้นหาด้วยเบอร์โทรหรือชื่อ').fill(DEMO.memberPhone);
    await page.getByRole('button', { name: 'ค้นหา' }).click();

    await page.locator('tr', { hasText: DEMO.memberPhone }).click();
    const modal = modalRoot(page);
    await expect(modal.getByText('แต้มคงเหลือ')).toBeVisible();

    const before = Number(await modal.locator('p.text-lg.font-extrabold').first().textContent());

    await modal.getByPlaceholder('+ / − แต้ม').fill('25');
    await modal.getByPlaceholder('เหตุผล (จำเป็น)').fill('E2E adjustment test');
    await modal.getByRole('button', { name: 'บันทึกการปรับแต้ม' }).click();

    await expect(modal.locator('p.text-lg.font-extrabold').first()).toHaveText(String(before + 25));
    await expect(modal.getByText(/ปรับแต้ม ·/).first()).toBeVisible();
    await expect(modal.getByText('+25', { exact: true }).first()).toBeVisible();
  });
});
