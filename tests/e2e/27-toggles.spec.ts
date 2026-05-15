import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

test.describe('@auth 9D-3 IOSToggle', () => {
  test('Feature toggle persists across reload', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsRealTestUser(page);
    await page.goto('/dashboard');
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="row-funktionen"]');

    const toggle = page.locator('[data-testid="toggle-memory"]');
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click();
    const after = before === 'true' ? 'false' : 'true';
    await expect(toggle).toHaveAttribute('aria-checked', after);

    await page.reload();
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="row-funktionen"]');
    await expect(page.locator('[data-testid="toggle-memory"]')).toHaveAttribute('aria-checked', after);
  });

  test('Toggle uses moss-green background when on', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsRealTestUser(page);
    await page.goto('/dashboard');
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="row-funktionen"]');

    const toggle = page.locator('[data-testid="toggle-web_search"]');
    const checked = await toggle.getAttribute('aria-checked');
    if (checked !== 'true') await toggle.click();
    const bg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
    // moss = #2D4A2B = rgb(45, 74, 43)
    expect(bg).toMatch(/rgb\(45,\s*74,\s*43\)/);
  });
});
