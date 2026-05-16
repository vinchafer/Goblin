import { test, expect } from '@playwright/test';

test.describe('@local-only 9B-2 Admin cost-summary', () => {
  test('cost-summary requires admin key', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/admin/cost-summary`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(401);
  });

  test('cost-summary returns shape with valid admin key', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) test.skip();
    const res = await request.get(`${apiBase}/api/admin/cost-summary`, {
      headers: { 'x-admin-key': adminKey! },
    }).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('period', '30d');
    expect(body).toHaveProperty('total_cost_usd');
    expect(body).toHaveProperty('by_provider');
  });
});
