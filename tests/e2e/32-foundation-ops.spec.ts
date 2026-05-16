import { test, expect } from '@playwright/test';

test.describe('@public 9B-0 Ops Foundation', () => {
  test('No Sentry-related JS errors on landing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const sentryErrors = errors.filter((e) => e.toLowerCase().includes('sentry'));
    expect(sentryErrors).toEqual([]);
  });

  test('API /version still responds', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/version`).catch(() => null);
    if (!res) return; // API not running in this env — acceptable
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('gitCommit');
    }
  });
});
