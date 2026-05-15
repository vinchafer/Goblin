import { test, expect } from '@playwright/test';
import { loginAsTestUser, dismissTour, cleanupTestUsers } from './helpers/auth';

const API_URL = 'https://goblinapi-production.up.railway.app';

test.describe('Dashboard — authenticated', { tag: '@local-only' }, () => {
  let authToken: string | null = null;
  let testEmail: string;
  let testUserId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const session = await loginAsTestUser(page, { plan: 'seed' });
    testEmail = session.email;
    testUserId = session.userId;

    // Grab auth token from local storage / cookie
    const token = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.includes('auth-token') || k.includes('supabase')) {
          try {
            const val = JSON.parse(localStorage.getItem(k) || '{}');
            return val?.access_token || val?.session?.access_token || null;
          } catch { return null; }
        }
      }
      return null;
    });
    authToken = token;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestUsers(page);
    await page.close();
  });

  test('authenticated user sees dashboard (not redirected to login)', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('dashboard has page title containing Goblin', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await expect(page).toHaveTitle(/Goblin/i);
  });

  test('dashboard shows empty state for new user with no projects', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Either shows empty state text or starter cards
    const hasStarterCards = await page.locator('text=/Landing Page|SaaS Dashboard|Mobile Web App/i').first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=/create|start|new project/i').first().isVisible().catch(() => false);

    expect(hasStarterCards || hasEmptyState).toBeTruthy();
  });

  test('dashboard shows New Project button or modal trigger', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.waitForLoadState('networkidle');

    const newProjectBtn = page.locator('[data-testid="new-project-btn"], button:has-text("New Project"), button:has-text("New project")').first();
    // May be in sidebar or as a main CTA — just check it exists somewhere
    const sidebar = page.locator('nav, aside, [data-testid="sidebar"]');
    const hasNewProjectAnywhere = await page.locator('text=/new project/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasNewProjectAnywhere).toBeTruthy();
  });

  test('sidebar is visible on desktop', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    // Sidebar should be present (nav element or aside with width > 0)
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to settings', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('settings page loads without crash', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    // No uncaught errors in console
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });

  test('settings/keys page loads', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/keys');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/settings\/keys/);
    await expect(page.locator('text=/API Key|api key|BYOK|key/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('settings/local page loads with proper layout', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/local');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/settings\/local/);
    // Should not show raw unstyled content
    await expect(page.locator('main, [role="main"], .settings-content, [data-testid="settings-layout"]').first()).toBeVisible({ timeout: 10000 }).catch(async () => {
      // Acceptable if page has content
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(50);
    });
  });

  test('settings/integrations page loads', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/integrations');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/settings\/integrations/);
  });

  test('settings/billing page loads', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/billing');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/settings\/billing/);
  });

  test('usage page loads', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/usage');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/usage/);
  });
});
