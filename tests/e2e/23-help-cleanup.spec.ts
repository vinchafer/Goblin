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

  test('/help page renders FAQ + email CTA', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');

    // /help was redesigned (now "Help & Support" + English FAQ). Assert the
    // CONTRACT — a top heading, the FAQ accordion, and a real support contact —
    // by structure/role so the next copy tweak does not re-break this.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/What is Goblin\?/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /support@justgoblin\.com/i })).toBeVisible();
  });
});
