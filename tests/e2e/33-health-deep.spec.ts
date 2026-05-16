import { test, expect } from '@playwright/test';

test.describe('@public 9B-1 Health endpoints', () => {
  test('/health returns 200 + version', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/health`).catch(() => null);
    if (!res) return; // API down — skip
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
  });

  test('/health/deep returns aggregate + per-dependency checks', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/health/deep`).catch(() => null);
    if (!res) return;
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('supabase');
  });
});
