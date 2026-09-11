import { test, expect, DEMO } from '../support/fixtures.js';

test.describe('Authentication & route guarding', () => {
  test('admin can log in and lands on the dashboard', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await expect(page.getByRole('heading', { name: 'แดชบอร์ด' })).toBeVisible();
  });

  test('cashier can log in and lands on the POS screen', async ({ page, loginAsCashier }) => {
    await loginAsCashier();
    await expect(page.getByRole('heading', { name: 'ยำแซ่บ POS' })).toBeVisible();
  });

  test('invalid credentials show an error and keep the user on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin / cashier').fill(DEMO.admin.username);
    await page.getByPlaceholder('••••••••').fill('wrong-password');
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();

    await expect(page.getByText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('an unauthenticated visitor is redirected to /login from a protected route', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a cashier cannot reach the /admin area', async ({ page, loginAsCashier }) => {
    await loginAsCashier();
    await page.goto('/admin/staff');
    await expect(page).toHaveURL(/\/pos/);
  });

  test('logout returns to the login screen and clears the session', async ({ page, loginAsCashier }) => {
    await loginAsCashier();
    await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Session cleared: navigating back to a protected route bounces to /login again.
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/login/);
  });
});
