import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

async function openSettingsSheet(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await dismissTour(page);
  // header-avatar is uniform path on both viewports (mobile + desktop)
  await page.locator('[data-testid="header-avatar"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.click('[data-testid="header-avatar"]');
  await page.click('[data-testid="avatar-menu-settings"]');
  await expect(page.locator('[data-testid="settings-sheet"]')).toBeVisible({ timeout: 5000 });
}

test.describe('@auth 9D-1 Settings Structure', () => {
  test('Settings Sheet — Profile-Card + 5 Groups visible', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openSettingsSheet(page);

    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();

    for (const group of ['Konto', 'Goblin', 'Design', 'App', 'Hilfe']) {
      await expect(page.locator(`text=${group}`).first()).toBeVisible();
    }

    await expect(page.locator('[data-testid="row-abrechnung"]')).toBeVisible();
    await expect(page.locator('[data-testid="row-funktionen"]')).toBeVisible();
    await expect(page.locator('[data-testid="row-api-keys"]')).toBeVisible();
    await expect(page.locator('[data-testid="row-haptic"]')).toBeVisible();
    await expect(page.locator('[data-testid="row-signout"]')).toBeVisible();
  });

  test('Profile: edit name, save, persists across reload', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openSettingsSheet(page);
    await page.click('[data-testid="profile-card"]');
    const input = page.locator('[data-testid="form-name"] input');
    await expect(input).toBeVisible();
    const newName = `Vincent ${Date.now() % 1000}`;
    await input.fill(newName);
    await page.click('[data-testid="profile-save"]');
    await page.waitForTimeout(1000);
    await page.reload();
    await openSettingsSheet(page);
    await page.click('[data-testid="profile-card"]');
    await expect(page.locator('[data-testid="form-name"] input')).toHaveValue(newName);
  });

  test('Stack-Navigation: open Funktionen, back returns to root', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openSettingsSheet(page);
    await page.click('[data-testid="row-funktionen"]');
    await expect(page.locator('text=Funktionen').first()).toBeVisible();
    await page.click('[aria-label="Zurück"]');
    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
  });
});
