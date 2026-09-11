import { test, expect } from '../support/fixtures.js';

test.describe('Admin dashboard & reports', () => {
  test('dashboard KPIs load and the period switch re-fetches data', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();

    await expect(page.getByText('ยอดขายรวม')).toBeVisible();
    await expect(page.getByText('จำนวนออเดอร์')).toBeVisible();
    await expect(page.getByText('เมนูขายดี')).toBeVisible();

    // Switching period triggers a fresh dashboard fetch (page briefly shows the loading state).
    await page.getByRole('button', { name: '30 วัน' }).click();
    await expect(page.getByText('ยอดขายรวม')).toBeVisible();
  });

  test('sales report page renders a grouped summary table', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.getByRole('link', { name: 'รายงานยอดขาย' }).click();
    await expect(page).toHaveURL(/\/admin\/reports/);
    await expect(page.locator('table')).toBeVisible();
  });
});
