import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

test.describe('@auth 9D-1 Settings Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsRealTestUser(page);
  });

  test('Settings Sheet — Profile-Card + 5 Groups visible', async ({ page }) => {
    await page.goto('/dashboard');
    // Open via sidebar Einstellungen entry (Sidebar uses setShowSettingsSheet)
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');

    await expect(page.locator('[data-testid="settings-sheet"]')).toBeVisible({ timeout: 5000 });
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
    await page.goto('/dashboard');
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="profile-card"]');
    const input = page.locator('[data-testid="form-name"] input');
    await expect(input).toBeVisible();
    const newName = `Vincent ${Date.now() % 1000}`;
    await input.fill(newName);
    await page.click('[data-testid="profile-save"]');
    await page.waitForTimeout(800);
    await page.reload();
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="profile-card"]');
    await expect(page.locator('[data-testid="form-name"] input')).toHaveValue(newName);
  });

  test('Stack-Navigation: open Funktionen, back returns to root', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="row-funktionen"]');
    await expect(page.locator('text=Funktionen').first()).toBeVisible();
    await page.click('[aria-label="Zurück"]');
    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
  });
});
