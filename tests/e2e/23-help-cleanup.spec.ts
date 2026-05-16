import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

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
    // 9D-6: avatar dropdown replaced with AvatarMenu BottomSheet (mobile + desktop).
    await loginAsRealTestUser(page);
    await dismissTour(page);
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="header-avatar"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.click('[data-testid="header-avatar"]');
    await expect(page.locator('[data-testid="avatar-menu-sheet"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Hilfe', { exact: true }).first()).toBeVisible();
  });

  test('/help page renders FAQ + email CTA', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Hilfe & Support/i })).toBeVisible();
    await expect(page.getByText(/Was ist Goblin\?/)).toBeVisible();
    await expect(page.getByText(/support@justgoblin\.com/).first()).toBeVisible();
  });
});
