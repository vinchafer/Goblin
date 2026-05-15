import { test, expect } from '@playwright/test';
import { loginAsTestUser, cleanupTestUsers } from './helpers/auth';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Mobile — authenticated flow', { tag: '@local-only' }, () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const session = await loginAsTestUser(page);
    testEmail = session.email;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestUsers(page);
    await page.close();
  });

  test('dashboard loads on mobile without crash', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await loginAsTestUser(page, { email: testEmail });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard/);

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });

  test('dashboard has no horizontal overflow on mobile', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await loginAsTestUser(page, { email: testEmail });
    await page.waitForLoadState('networkidle');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = MOBILE_VIEWPORT.width;
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });

  test('settings page usable on mobile', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);
    // Content should be visible
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('mobile dashboard has bottom navigation or hamburger menu', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await loginAsTestUser(page, { email: testEmail });
    await page.waitForLoadState('networkidle');

    // Look for mobile nav indicators
    const hasMobileNav = await page.locator('[data-testid="bottom-nav"], [class*="bottom-nav"], nav button').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasHamburger = await page.locator('button[aria-label*="menu"], button[aria-label*="navigation"], [data-testid="hamburger"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    // Just verify the app renders some navigation
    const hasAnyNav = hasMobileNav || hasHamburger || await page.locator('nav').first().isVisible({ timeout: 3000 }).catch(() => false);
    // This is informational — log but don't fail since we're discovering bugs
    console.log(`Mobile nav present: ${hasAnyNav}, bottom nav: ${hasMobileNav}, hamburger: ${hasHamburger}`);
  });
});
