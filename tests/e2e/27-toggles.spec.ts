import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour, openSettingsSection } from './helpers/auth';

// Open the Funktionen (Features) section via whichever settings shell the
// viewport renders (mobile sheet row vs desktop modal nav). FeaturesPage is a
// shared component, so the toggle test-ids are identical across both.
async function openFunktionen(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await dismissTour(page);
  await openSettingsSection(page, 'row-funktionen', 'Funktionen');
}

test.describe('@auth 9D-3 IOSToggle', () => {
  test('Feature toggle persists across reload', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openFunktionen(page);

    const toggle = page.locator('[data-testid="toggle-haptic"] [role="switch"]');
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click();
    const after = before === 'true' ? 'false' : 'true';
    await expect(toggle).toHaveAttribute('aria-checked', after);

    await page.reload();
    await openFunktionen(page);
    await expect(page.locator('[data-testid="toggle-haptic"] [role="switch"]')).toHaveAttribute('aria-checked', after);
  });

  test('Toggle uses a green (brand) background when on', async ({ page }) => {
    await loginAsRealTestUser(page);
    await openFunktionen(page);

    const toggle = page.locator('[data-testid="toggle-haptic"] [role="switch"]');
    await expect(toggle).toBeVisible();
    const checked = await toggle.getAttribute('aria-checked');
    if (checked !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // "On" uses var(--brand-green) (IOSToggle). Assert it is a green — green
    // channel dominant, clearly not the gray off-state — rather than pinning an
    // exact RGB, so a future brand-green tweak does not re-break this.
    const bg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(m, `toggle background was "${bg}"`).not.toBeNull();
    const [r, g, b] = [Number(m![1]), Number(m![2]), Number(m![3])];
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });
});
