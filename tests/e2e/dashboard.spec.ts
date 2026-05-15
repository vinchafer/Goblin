import { test, expect } from '@playwright/test';

/**
 * Dashboard tests — all run in the unauthenticated state because setting up a
 * real Supabase session in CI without live credentials is not feasible.
 * They verify the redirect/gating behaviour and login-page structure seen by
 * any visitor who hits a protected URL.
 */

test.describe('Dashboard — unauthenticated access', { tag: '@public' }, () => {
  test('GET /dashboard redirects to /login', async ({ page }) => {
    const response = await page.goto('/dashboard');
    // After following redirects we must be on the login page
    await expect(page).toHaveURL(/\/login/);
    // The final HTTP status after the redirect chain should be 200
    expect(response?.status()).toBeLessThan(400);
  });

  test('/dashboard/settings redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/dashboard/billing redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Login page content (entry point for dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('has "Continue with Google" (or Sign in with Google) button', async ({ page }) => {
    // The button text is "Sign in with Google" in the implementation
    await expect(
      page.getByRole('button', { name: /google/i })
    ).toBeVisible();
  });

  test('login card is rendered with heading', async ({ page }) => {
    // Heading is now "Welcome back" or "Create your account"
    const card = page.locator('h1').filter({ hasText: /welcome back|create your account/i }).first();
    await expect(card).toBeVisible();
  });

  test('email login section is present', async ({ page }) => {
    // Email login exists (may be button or input)
    const hasEmail = await page.locator('text=/email/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasEmail).toBeTruthy();
  });
});

test.describe('404 behavior', () => {
  test('unknown protected route redirects unauthenticated user to login', async ({ page }) => {
    // Middleware redirects unknown routes to /login when not authenticated
    await page.goto('/this-page-does-not-exist-at-all');
    await expect(page).toHaveURL(/\/login/);
  });
});
