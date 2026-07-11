import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour, openAvatarMenu } from './helpers/auth';

test.describe('9C — Help cleanup (BUG-014, BUG-015)', { tag: '@auth' }, () => {
  test('No floating SupportBubble button on dashboard', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // SupportBubble had aria-label "Open support"
    await expect(page.getByRole('button', { name: /open support/i })).not.toBeVisible();
  });

  test('Avatar menu contains "Hilfe" entry', async ({ page }) => {
    // 9D-6: account menu is a popover on desktop, a BottomSheet on mobile;
    // openAvatarMenu resolves either. The "Hilfe" row is shared menu body.
    await loginAsRealTestUser(page);
    await dismissTour(page);
    await page.waitForLoadState('networkidle');

    const menu = await openAvatarMenu(page);
    await expect(menu.getByText('Hilfe', { exact: true }).first()).toBeVisible();
  });

  test('/help page renders the article index + email CTA', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');

    // WAVE-J (e9ce1c0) redesigned /help: it is no longer a flat FAQ list but an
    // ARTICLE INDEX (HELP_ARTICLES → /help/<slug> cards) plus a help-agent CTA. This
    // spec previously asserted the old FAQ question ("Was ist Goblin?"), which now
    // lives inside the articles, not on the index — a stale expectation, not a page
    // bug. Assert the real CONTRACT by structure/role (language-agnostic — /help is
    // bilingual and defaults to German unauthenticated): a top heading, at least one
    // article link into /help/<slug>, and a real support contact.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href^="/help/"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /support@justgoblin\.com/i })).toBeVisible();
  });
});
