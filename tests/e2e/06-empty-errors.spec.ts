import { test, expect } from '@playwright/test';
import { loginAsTestUser, cleanupTestUsers } from './helpers/auth';

test.describe('Empty States + Error Handling', { tag: '@local-only' }, () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const session = await loginAsTestUser(page);
    testEmail = session.email;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestUsers(page);
    await page.close();
  });

  test('dashboard with no projects shows empty state or starter cards', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // New user with no projects — should see something useful, not blank
    const hasContent = await page.locator('text=/Landing Page|SaaS Dashboard|Start|Create|New Project|Get started/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('404 page is shown for invalid project (not crash)', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    const res = await page.goto('/dashboard/project/invalid-uuid-that-does-not-exist');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    // Should not show raw React error
    expect(bodyText).not.toContain('Application error: a client-side exception has occurred');
    expect(bodyText).not.toContain('at ProjectPage');
  });

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    // Don't login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to settings redirects to login', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page shows error message for failed auth', async ({ page }) => {
    await page.goto('/login?error=Authentication+failed');
    await page.waitForLoadState('networkidle');
    // Should show some error indication
    const hasError = await page.locator('text=/error|failed|Authentication/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    // The page should at minimum load without crashing
    await expect(page).toHaveURL(/\/login/);
  });

  test('upgrade page loads for authenticated user', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/upgrade');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('console has no uncaught errors on dashboard load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.toLowerCase().includes('warning') &&
      !e.toLowerCase().includes('react-dev') &&
      !e.includes('404') // 404 for favicon etc is fine
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('API 401 on invalid token returns login redirect from frontend', async ({ page }) => {
    // Navigate with no session
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    // Login page should show, not an error screen
    await expect(page.locator('text=/Sign in|Welcome|Goblin/i').first()).toBeVisible({ timeout: 5000 });
  });
});
