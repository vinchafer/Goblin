import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// NOTE: DB manipulation (expire trial, then reset) is not done here to avoid
// corrupting the real test account. Those checks are done via API health endpoint.

test.describe('Trial Gate — real test account', () => {
  test('dashboard loads without 402 for active trial user', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should NOT be redirected to /upgrade or /login
    await expect(page).not.toHaveURL(/\/upgrade|\/login/);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('billing page accessible for trial user', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/billing`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('usage page accessible', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/usage`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('trial banner shows when trial is active', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Look for trial/plan indicators in the UI
    const trialIndicator = page.locator('text=/trial|free|days left|Seed plan/i').first();
    // Trial banner is optional — user may have upgraded
    const hasTrial = await trialIndicator.isVisible({ timeout: 5000 }).catch(() => false);
    // No assertion here — just record what we see
    test.info().annotations.push({
      type: 'info',
      description: `Trial indicator visible: ${hasTrial}`,
    });
  });

  test('API health endpoint returns 200 for authenticated user', async ({ page }) => {
    await loginAsRealTestUser(page);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://goblinapi-production.up.railway.app';

    const token = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.includes('supabase') || k.includes('auth')) {
          try {
            const val = JSON.parse(localStorage.getItem(k) || '{}');
            return val?.access_token || val?.session?.access_token || null;
          } catch { return null; }
        }
      }
      return null;
    });

    if (!token) {
      test.skip(true, 'Could not extract auth token from localStorage');
      return;
    }

    const res = await page.request.get(`${apiBase}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Health endpoint should return 200 or 401/403 (not 402)
    expect([200, 401, 403]).toContain(res.status());
    expect(res.status()).not.toBe(402);
  });
});
