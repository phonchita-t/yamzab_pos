import { test, expect } from '@playwright/test';

/**
 * Contract-level checks against the Express API directly (no browser UI).
 * Confirms authentication + role-based access control hold at the HTTP
 * layer, independent of the client's own route guards.
 */
const API = process.env.E2E_API_URL || 'http://localhost:4000';

async function loginToken(request, username, password) {
  const res = await request.post(`${API}/api/auth/login`, { data: { username, password } });
  expect(res.ok()).toBeTruthy();
  const { token } = await res.json();
  return token;
}

test.describe('API: auth & RBAC contract', () => {
  test('rejects bad credentials with 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'admin', password: 'not-the-password' },
    });
    expect(res.status()).toBe(401);
  });

  test('rejects requests with no token', async ({ request }) => {
    const res = await request.get(`${API}/api/orders`);
    expect(res.status()).toBe(401);
  });

  test('a cashier token is denied on admin-only endpoints', async ({ request }) => {
    const token = await loginToken(request, 'cashier', 'password123');

    const dashboard = await request.get(`${API}/api/reports/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dashboard.status()).toBe(403);

    const users = await request.get(`${API}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(users.status()).toBe(403);
  });

  test('an admin token can reach admin-only endpoints', async ({ request }) => {
    const token = await loginToken(request, 'admin', 'password123');
    const res = await request.get(`${API}/api/reports/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.kpis).toBeTruthy();
  });

  test('checkout rejects an underpaid bill with 422', async ({ request }) => {
    const token = await loginToken(request, 'cashier', 'password123');
    const products = await (
      await request.get(`${API}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } })
    ).json();
    const product = products.find((p) => p.isAvailable && !p.optionGroups?.length);
    expect(product).toBeTruthy();

    const res = await request.post(`${API}/api/orders/checkout`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ method: 'CASH', amount: 0.01, tendered: 0.01 }],
      },
    });
    expect(res.status()).toBe(422);
  });
});
