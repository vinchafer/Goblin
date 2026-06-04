import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour, openAvatarMenu } from './helpers/auth';

test.describe('@auth 9D-6 Avatar Menu', () => {
  test('Avatar opens menu, Settings opens the settings surface', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Behaviour under test: avatar opens the account menu (popover on desktop,
    // sheet on mobile — openAvatarMenu resolves either), and the menu offers
    // Settings, which opens the settings surface (modal on desktop, sheet on
    // mobile). Assert by the shared menu item + the device-agnostic surface,
    // not by a single-shell test-id.
    const menu = await openAvatarMenu(page);
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('avatar-menu-settings')).toBeVisible();

    // Menu is already open — click Settings directly (re-opening would toggle it shut).
    await page.click('[data-testid="avatar-menu-settings"]');
    const settings = page.locator('[data-testid="settings-modal"], [data-testid="settings-sheet"]').first();
    await expect(settings).toBeVisible({ timeout: 5000 });
    // "Modelle" is a settings section present in both shells (SettingsRoot row
    // on mobile, left-nav button on desktop) — proves settings actually rendered.
    await expect(settings.getByText('Modelle', { exact: true }).first()).toBeVisible();
  });
});
