import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

async function openFunktionen(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await dismissTour(page);
  await page.locator('[data-testid="header-avatar"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.click('[data-testid="header-avatar"]');
  await page.click('[data-testid="avatar-menu-settings"]');
  await page.click('[data-testid="row-funktionen"]');
}

test.describe('@auth 9D-3 IOSToggle', () => {
  test('Feature toggle persists across reload', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openFunktionen(page);

    const toggle = page.locator('[data-testid="toggle-memory"]');
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click();
    const after = before === 'true' ? 'false' : 'true';
    await expect(toggle).toHaveAttribute('aria-checked', after);

    await page.reload();
    await openFunktionen(page);
    await expect(page.locator('[data-testid="toggle-memory"]')).toHaveAttribute('aria-checked', after);
  });

  test('Toggle uses moss background when on', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openFunktionen(page);

    const toggle = page.locator('[data-testid="toggle-web_search"]');
    await expect(toggle).toBeVisible();
    const checked = await toggle.getAttribute('aria-checked');
    if (checked !== 'true') await toggle.click();
    const bg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
    // moss light = rgb(45,74,43), dark = rgb(58,94,56)
    expect(bg).toMatch(/rgb\((45|58),\s*(74|94),\s*(43|56)\)/);
  });
});
