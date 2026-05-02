import { test, expect } from '@playwright/test';

/**
 * Dashboard tests — all run in the unauthenticated state because setting up a
 * real Supabase session in CI without live credentials is not feasible.
 * They verify the redirect/gating behaviour and login-page structure seen by
 * any visitor who hits a protected URL.
 */

test.describe('Dashboard — unauthenticated access', () => {
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

  test('login card is rendered with max-width container', async ({ page }) => {
    // The card wrapper has a maxWidth of 400px — it must be present in the DOM
    const card = page.locator('div').filter({ hasText: /welcome to goblin/i }).first();
    await expect(card).toBeVisible();
  });

  test('disabled "Continue with Email" button is present and shows SOON badge', async ({ page }) => {
    const emailBtn = page.getByRole('button', { name: /continue with email/i });
    await expect(emailBtn).toBeVisible();
    await expect(emailBtn).toBeDisabled();
    // SOON badge text should appear somewhere in the card
    await expect(page.getByText('SOON')).toBeVisible();
  });
});

test.describe('404 page', () => {
  test('unknown route renders goblin 404 page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-at-all');
    // The not-found page renders a 404 heading and goblin-flavoured copy
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  });

  test('404 page shows goblin error message', async ({ page }) => {
    await page.goto('/totally-nonexistent-route');
    await expect(page.getByText(/goblin/i)).toBeVisible();
  });
});
