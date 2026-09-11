import { test, expect, DEMO } from '../support/fixtures.js';

test.describe('Member lookup & loyalty at checkout', () => {
  test('looking up a Gold-tier member applies their tier discount', async ({ page, loginAsCashier }) => {
    await loginAsCashier();

    await page.getByRole('button', { name: /ไก่ย่างครึ่งตัว/ }).click();
    await page.getByRole('button', { name: /^คิดเงิน/ }).click();

    await page.getByPlaceholder('เบอร์โทรศัพท์').fill(DEMO.goldMemberPhone);
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

    await expect(page.getByText(DEMO.goldMemberPhone)).toBeVisible();
    await expect(page.getByText('Gold', { exact: true })).toBeVisible();
    await expect(page.getByText(/ส่วนลดระดับ Gold/)).toBeVisible();

    // Removing the member drops the tier discount line again.
    await page.getByRole('button', { name: 'นำออก' }).click();
    await expect(page.getByText(/ส่วนลดระดับ Gold/)).not.toBeVisible();
  });

  test('an unknown phone number offers inline member registration', async ({ page, loginAsCashier }) => {
    await loginAsCashier();

    await page.getByRole('button', { name: /ไก่ย่างครึ่งตัว/ }).click();
    await page.getByRole('button', { name: /^คิดเงิน/ }).click();

    const freshPhone = `09${String(Date.now()).slice(-8)}`;
    await page.getByPlaceholder('เบอร์โทรศัพท์').fill(freshPhone);
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

    await expect(page.getByText(`ไม่พบสมาชิก ต้องการสมัคร ${freshPhone} หรือไม่?`)).toBeVisible();
    await page.getByPlaceholder('ชื่อลูกค้า (ไม่บังคับ)').fill('ลูกค้าทดสอบ E2E');
    await page.getByRole('button', { name: 'สมัครและผูกกับบิล' }).click();

    await expect(page.getByText('ลูกค้าทดสอบ E2E')).toBeVisible();
    await expect(page.getByText(freshPhone)).toBeVisible();
  });
});
