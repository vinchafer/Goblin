import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loginAsRealTestUser, dismissTour, openSettings, isDesktopViewport } from './helpers/auth';

// Settings has two intentional shells (settings-sheet.tsx / SettingsModal.tsx):
//   • mobile → BottomSheet with SettingsRoot (profile-card, SettingsGroup labels,
//     row-* test-ids, sheet-stack "Zurück" navigation)
//   • desktop → two-pane modal with a left-nav of the SAME sections (shared
//     section page components, same German labels, GROUP_LABELS).
// The five group labels (Konto/Goblin/Design/App/Hilfe) and the section labels
// are identical across both, so we assert section PRESENCE by label/role/test-id
// per shell rather than pinning one shell's layout.

async function openProfile(page: Page): Promise<void> {
  const surface = await openSettings(page);
  if (isDesktopViewport(page)) {
    await surface.getByRole('button', { name: 'Profil', exact: true }).first().click();
  } else {
    await page.click('[data-testid="profile-card"]');
  }
}

test.describe('@auth 9D-1 Settings Structure', () => {
  test('Settings surface — profile + the five groups + key sections present', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);
    const surface = await openSettings(page);

    // The five settings groups exist in both shells (same labels).
    for (const group of ['Konto', 'Goblin', 'Design', 'App', 'Hilfe']) {
      await expect(surface.getByText(group, { exact: true }).first()).toBeVisible();
    }
    // Key sections reachable in both shells (SettingsRoot rows / modal nav buttons).
    for (const section of ['Abrechnung', 'Funktionen', 'Modelle', 'Erscheinungsbild', 'Hilfecenter']) {
      await expect(surface.getByText(section, { exact: true }).first()).toBeVisible();
    }

    if (isDesktopViewport(page)) {
      await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
    } else {
      // Mobile sheet keeps the richer structure assertions (profile-card + rows).
      await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
      for (const row of ['row-abrechnung', 'row-funktionen', 'row-models', 'row-appearance', 'row-help', 'row-haptic', 'row-signout']) {
        await expect(page.locator(`[data-testid="${row}"]`)).toBeVisible();
      }
    }
  });

  test('Profile: edit name, save, persists across reload', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);
    await openProfile(page);

    const input = page.locator('[data-testid="form-name"] input');
    await expect(input).toBeVisible();
    const newName = `Vincent ${Date.now() % 1000}`;
    await input.fill(newName);
    await page.click('[data-testid="profile-save"]');
    await page.waitForTimeout(1500);

    await page.reload();
    await dismissTour(page);
    await openProfile(page);
    await expect(page.locator('[data-testid="form-name"] input')).toHaveValue(newName);
  });

  test('Navigation: open Funktionen, then return to another section', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);

    if (isDesktopViewport(page)) {
      // Desktop modal: left-nav selection (no sheet-stack back button).
      const surface = await openSettings(page);
      await surface.getByRole('button', { name: 'Funktionen', exact: true }).first().click();
      await expect(surface.getByText('Funktionen').first()).toBeVisible();
      await surface.getByRole('button', { name: 'Profil', exact: true }).first().click();
      await expect(page.locator('[data-testid="form-name"]')).toBeVisible();
    } else {
      // Mobile sheet: stack-navigation with a "Zurück" affordance back to root.
      await openSettings(page);
      await page.click('[data-testid="row-funktionen"]');
      await expect(page.locator('text=Funktionen').first()).toBeVisible();
      await page.click('[aria-label="Zurück"]');
      await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
    }
  });
});
