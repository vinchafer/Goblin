import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

// NewChatPage redirects /dashboard/chat → /dashboard/chat/<id> via API call.
// If API hiccups it falls back to /dashboard. Don't depend on URL — wait for composer.
async function gotoNewChat(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/chat', { waitUntil: 'commit' });
  // Wait for composer-plus (signals ChatInput mounted) — covers both
  // redirect-to-session-id success path and any nested layout transitions.
  await page.locator('[data-testid="composer-plus"]').waitFor({ state: 'visible', timeout: 45000 });
}

test.describe('@auth 9D-5 Empty State + Plus Popover', () => {
  test('Plus-popover opens with 5 items', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsRealTestUser(page);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await gotoNewChat(page);
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
    test.setTimeout(90000);
    await loginAsRealTestUser(page);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await gotoNewChat(page);
    await expect(page.locator('text=/Guten (Morgen|Tag|Nachmittag|Abend), /').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="suggestion-build"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-debug"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-deploy"]')).toBeVisible();
  });
});
