import { test, expect } from '@playwright/test';

test.describe('Login page', { tag: '@public' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('page title contains "Goblin"', async ({ page }) => {
    await expect(page).toHaveTitle(/Goblin/i);
  });

  test('shows Continue with Google button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /continue with google/i })
    ).toBeVisible();
  });

  test('shows Continue with GitHub button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /continue with github/i })
    ).toBeVisible();
  });

  test('has heading (Create your account or Welcome back)', async ({ page }) => {
    // Page defaults to signup mode → "Create your account"; sign-in mode → "Welcome back"
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    const text = await heading.innerText();
    expect(text).toMatch(/create your account|welcome back/i);
  });

  test('has Terms and Privacy links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /terms/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy/i }).first()).toBeVisible();
  });

  test('email login section exists', async ({ page }) => {
    // Email login should exist (either as button or form)
    const hasEmail = await page.locator('text=/email|Email/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasEmail).toBeTruthy();
  });
});

test.describe('Protected route redirects', () => {
  test('/dashboard redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/dashboard/settings redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});
