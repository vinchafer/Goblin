import { test, expect } from '@playwright/test';

/**
 * Auth tests — cover the login page structure and unauthenticated redirect
 * behaviour without performing any real OAuth flow.
 */

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('page title contains "Goblin"', async ({ page }) => {
    await expect(page).toHaveTitle(/Goblin/i);
  });

  test('shows Sign in with Google button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /sign in with google/i })
    ).toBeVisible();
  });

  test('shows Sign in with GitHub button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /sign in with github/i })
    ).toBeVisible();
  });

  test('shows Sign in with Apple button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /sign in with apple/i })
    ).toBeVisible();
  });

  test('has correct heading "Welcome to Goblin"', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /welcome to goblin/i })
    ).toBeVisible();
  });

  test('has Terms and Privacy links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /terms/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
  });
});

test.describe('Protected route redirects', () => {
  test('/dashboard redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard');
    // Middleware redirects to /login?redirect=/dashboard
    await expect(page).toHaveURL(/\/login/);
  });

  test('/dashboard/settings redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});
