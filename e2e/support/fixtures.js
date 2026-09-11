import { test as base, expect } from '@playwright/test';

/**
 * Demo accounts / data created by `npm run db:seed` (server/prisma/seed.js).
 * Keep in sync with that file if the demo dataset changes.
 */
export const DEMO = {
  admin: { username: 'admin', password: 'password123' },
  cashier: { username: 'cashier', password: 'password123' },
  memberPhone: '0812345678', // "Member" tier, has a points balance
  goldMemberPhone: '0899999999', // "Gold" tier
};

async function login(page, { username, password }) {
  await page.goto('/login');
  await page.getByPlaceholder('admin / cashier').fill(username);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
}

/**
 * Extends the base Playwright test with `loginAsAdmin` / `loginAsCashier`
 * helpers so specs don't repeat the login form interaction.
 */
export const test = base.extend({
  loginAsAdmin: async ({ page }, use) => {
    await use(async () => {
      await login(page, DEMO.admin);
      await expect(page).toHaveURL(/\/admin/);
    });
  },
  loginAsCashier: async ({ page }, use) => {
    await use(async () => {
      await login(page, DEMO.cashier);
      await expect(page).toHaveURL(/\/pos/);
    });
  },
});

export { expect };

/**
 * Most forms in this app render `<label>text</label><input .../>` as plain
 * adjacent siblings with no `for`/`id` wiring, so `getByLabel` can't see
 * them. This locates the control that immediately follows a given label.
 */
export function fieldFor(scope, label) {
  const text = label.replace(/"/g, '\\"');
  return scope.locator(
    [
      `label:text-is("${text}") + input`,
      `label:text-is("${text}") + select`,
      `label:text-is("${text}") + textarea`,
    ].join(', '),
  );
}

/** The app's <Modal> has no role="dialog"; scope by its fixed overlay wrapper. */
export function modalRoot(page) {
  return page.locator('.fixed.inset-0.z-50').last();
}
