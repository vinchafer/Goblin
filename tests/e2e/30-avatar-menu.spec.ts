import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.describe('@auth 9D-6 Avatar Menu', () => {
  test('Avatar opens sheet, Settings opens settings sheet', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await page.locator('[data-testid="header-avatar"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.click('[data-testid="header-avatar"]');
    await expect(page.locator('[data-testid="avatar-menu-sheet"]')).toBeVisible();
    await page.click('[data-testid="avatar-menu-settings"]');
    await expect(page.locator('[data-testid="settings-sheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
  });
});
