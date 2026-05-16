import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

// Tagged @local-only because /dashboard/chat depends on a runtime API call
// (POST /api/chat-sessions) inside NewChatPage. On CI the apps/api service
// returns 401/500 intermittently for the real test account, causing
// router.push('/dashboard') fallback — composer never mounts. Vincent verifies
// both flows manually on real iPhone per 9E_BACKLOG.md.

async function gotoNewChat(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/chat', { waitUntil: 'commit' });
  await page.locator('[data-testid="composer-plus"]').waitFor({ state: 'visible', timeout: 45000 });
}

test.describe('@local-only 9D-5 Empty State + Plus Popover', () => {
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

test.describe('@local-only 9D-5 Empty Chat Greeting', () => {
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
