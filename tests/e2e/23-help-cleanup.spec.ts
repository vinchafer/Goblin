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

  test('/help page renders the article index + agent-first support (no one-click human path)', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');

    // WAVE-J redesigned /help into an ARTICLE INDEX (HELP_ARTICLES → /help/<slug> cards)
    // plus a help-agent CTA. FW5-U4 (D-E) then made support AGENT-FIRST: the one-click
    // "I need a human" link and the plaintext support address were REMOVED from the
    // above-the-fold card — the agent is the single entry point and a human handoff
    // happens through it. So the contract is: a top heading, at least one article link,
    // the agent-chat CTA present, and NO plaintext support-email link on the card. The
    // honest-failure mailto fallback still lives INSIDE the chat (support-chat.tsx) and
    // the legal contact stays on the Impressum — neither is on this page's card.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href^="/help/"]').first()).toBeVisible();
    // The agent CTA is the entry point (bilingual — matches DE + EN label).
    await expect(page.getByRole('button', { name: /Goblin.?(Hilfe|help)/i }).first()).toBeVisible();
    // Agent-first: no one-click mailto and no plaintext support address on the card.
    await expect(page.locator('a[href="mailto:support@justgoblin.com"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /support@justgoblin\.com/i })).toHaveCount(0);
  });
});
