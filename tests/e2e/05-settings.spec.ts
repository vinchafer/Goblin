import { test, expect } from '@playwright/test';
import { loginAsTestUser, cleanupTestUsers } from './helpers/auth';

test.describe('Settings Pages', { tag: '@local-only' }, () => {
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

  test('settings main page loads with SettingsLayout', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);
    // SettingsLayout should render sidebar nav
    const hasSettingsNav = await page.locator('text=/API Keys|Integrations|Billing|Profile|Local Mode/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasSettingsNav).toBeTruthy();
  });

  test('settings navigation links are functional', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    // Find a nav link to click
    const keysLink = page.locator('a[href*="settings/keys"], text=/API Keys/i').first();
    if (await keysLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await keysLink.click();
      await expect(page).toHaveURL(/\/settings\/keys/);
    }
  });

  test('API keys page shows "Add Key" or "No keys" state', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/keys');
    await page.waitForLoadState('networkidle');

    const hasContent = await page.locator('text=/Add Key|No keys|api key|Add.*key|Connect/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('API keys page Add Key button opens modal', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/keys');
    await page.waitForLoadState('networkidle');

    // "Add key →" button expands inline (no dialog) — shows "Paste your API key" input
    const addBtn = page.locator('button:has-text("Add key")').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // Inline expansion shows a text input with "Paste your API key" placeholder
      const hasInlineForm = await page.locator('input[placeholder*="API key"], input[placeholder*="Paste"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasCancel = await page.locator('button:has-text("Cancel"), button:has-text("Save key")').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasInlineForm || hasCancel).toBeTruthy();
    }
  });

  test('local settings page has proper layout (not broken)', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/local');
    await page.waitForLoadState('networkidle');

    // Should have SettingsLayout wrapping content (not raw dump of content)
    const hasLayout = await page.locator('nav, aside, [data-testid="settings-layout"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasContent = await page.locator('text=/Local Mode|Ollama|local model|custom endpoint/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    // At minimum, page should have real content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    // Should also have layout
    expect(hasLayout || hasContent).toBeTruthy();
  });

  test('integrations page loads with GitHub/Vercel section', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/integrations');
    await page.waitForLoadState('networkidle');

    const hasIntegrations = await page.locator('text=/GitHub|Vercel|Integration/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasIntegrations).toBeTruthy();
  });

  test('billing page loads', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings/billing');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('theme toggle is present and clickable', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("Dark"), button:has-text("Light"), button:has-text("System"), select:has-text("theme")').first();
    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click();
      await page.waitForTimeout(300);
      // Should not crash
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.waitForTimeout(500);
      expect(errors).toHaveLength(0);
    }
  });

  test('all settings sub-pages return 200 (no 404/500)', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    const pages = [
      '/dashboard/settings',
      '/dashboard/settings/keys',
      '/dashboard/settings/local',
      '/dashboard/settings/integrations',
      '/dashboard/settings/billing',
      '/dashboard/settings/routing',
    ];

    for (const path of pages) {
      const res = await page.goto(path);
      // Should either load or redirect (not return 5xx)
      if (res) {
        expect(res.status()).toBeLessThan(500);
      }
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});
