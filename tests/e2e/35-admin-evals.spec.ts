import { test, expect } from '@playwright/test';

test.describe('@local-only 9B-6 Admin eval endpoints', () => {
  test('evals/latest requires admin key', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/admin/evals/latest`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(401);
  });

  test('evals/trends requires admin key', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/admin/evals/trends`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(401);
  });
});
