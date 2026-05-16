import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.describe('@auth 9D-5 Empty State + Plus Popover', () => {
  test('Plus-popover opens with 5 items', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto('/dashboard/chat');
    await page.waitForURL(/\/dashboard\/chat/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await page.locator('[data-testid="composer-plus"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.click('[data-testid="composer-plus"]');
    await expect(page.locator('[data-testid="composer-plus-popover"]')).toBeVisible();
    await expect(page.locator('text=Datei oder Foto')).toBeVisible();
    await expect(page.locator('text=Screenshot')).toBeVisible();
    await expect(page.locator('text=Aus GitHub')).toBeVisible();
    await expect(page.locator('text=Recherche')).toBeVisible();
    await expect(page.locator('text=Websuche')).toBeVisible();
  });
});

test.describe('@auth 9D-5 Empty Chat Greeting', () => {
  test('Empty chat shows time-based greeting on new session', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto('/dashboard/chat');
    await page.waitForURL(/\/dashboard\/chat/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await expect(page.locator('text=/Guten (Morgen|Tag|Nachmittag|Abend), /').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="suggestion-build"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-debug"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-deploy"]')).toBeVisible();
  });
});
