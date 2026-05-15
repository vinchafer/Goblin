import { test, expect, devices } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.use({ ...devices['Pixel 7'] });

test.describe('9C — Mobile Sidebar slides from LEFT (BUG-012)', { tag: '@auth' }, () => {
  test('Sidebar opens anchored to left edge, not bottom', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);

    const sidebar = page.locator('.goblin-sidebar-mobile');

    // Tap hamburger (aria-label "Open menu" exists pre-9C)
    await page.getByRole('button', { name: /open menu/i }).click();

    // After open: sidebar visible, anchored to left (x ≈ 0)
    await expect(sidebar).toBeVisible({ timeout: 2000 });
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThanOrEqual(1); // anchored left
    expect(box!.y).toBeLessThanOrEqual(1); // anchored top (NOT bottom)
    expect(box!.height).toBeGreaterThan(400); // full-height
  });

  test('Sidebar contains user-pill (no API Keys/Billing/Settings buttons in main nav)', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);
    await page.getByRole('button', { name: /open menu/i }).click();

    const sidebar = page.locator('.goblin-sidebar-mobile');
    await expect(sidebar).toBeVisible();

    // User-pill = button with aria-label "Account & settings"
    await expect(sidebar.getByRole('button', { name: /account.*settings/i })).toBeVisible();

    // No multiple separate API-Keys/Billing buttons in sidebar.
    const apiKeyButtonCount = await sidebar.locator('button:has-text("API Keys")').count();
    const billingButtonCount = await sidebar.locator('button:has-text("Billing")').count();
    expect(apiKeyButtonCount).toBe(0);
    expect(billingButtonCount).toBe(0);
  });
});
