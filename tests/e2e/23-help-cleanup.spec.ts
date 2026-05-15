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

  test('Avatar dropdown contains "Hilfe & Support" link', async ({ page }) => {
    await loginAsRealTestUser(page); // already lands on /dashboard
    await dismissTour(page);
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="avatar-button"]').click();
    await expect(page.locator('[data-testid="menu-item-help"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Hilfe & Support').first()).toBeVisible();
  });

  test('/help page renders FAQ + email CTA', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Hilfe & Support/i })).toBeVisible();
    await expect(page.getByText(/Was ist Goblin\?/)).toBeVisible();
    await expect(page.getByText(/support@justgoblin\.com/).first()).toBeVisible();
  });
});
