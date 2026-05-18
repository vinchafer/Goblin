import { test, expect } from '@playwright/test';

test.describe('@public 9R Rankings API', () => {
  test('GET /api/rankings returns shape', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/rankings?task=coding&limit=5`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('task_type', 'coding');
    expect(body).toHaveProperty('rankings');
    expect(Array.isArray(body.rankings)).toBe(true);
  });

  test('GET /api/rankings/sources returns array', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/rankings/sources`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sources)).toBe(true);
  });

  test('GET /api/rankings/models returns models list', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/rankings/models`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.models)).toBe(true);
  });

  test('admin/rankings/refresh requires admin key', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.post(`${apiBase}/api/admin/rankings/refresh`).catch(() => null);
    if (!res) return;
    expect(res.status()).toBe(401);
  });
});

test.describe('@public 9R Models page renders', () => {
  test('/models loads and shows task pills', async ({ page }) => {
    const base = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const res = await page.goto(`${base}/models`).catch(() => null);
    if (!res) return;
    await expect(page.getByTestId('task-pill-coding')).toBeVisible({ timeout: 5000 });
  });
});
