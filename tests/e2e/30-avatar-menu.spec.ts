import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

test.describe('@auth 9D-6 Avatar Menu', () => {
  test('Mobile: avatar opens sheet, Settings opens settings sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsRealTestUser(page);
    await page.goto('/dashboard');
    await page.click('[data-testid="header-avatar"]');
    await expect(page.locator('[data-testid="avatar-menu-sheet"]')).toBeVisible();
    await page.click('[data-testid="avatar-menu-settings"]');
    await expect(page.locator('[data-testid="settings-sheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
  });
});
