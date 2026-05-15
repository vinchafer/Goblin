import { test, expect } from '@playwright/test';

test.describe('9C — Footer social labels not single letters', { tag: '@public' }, () => {
  test('Footer shows full text labels Discord/Twitter/GitHub', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Brand-block social pills: target=_blank with real URLs (not # nav-col placeholders)
    const social = page.locator('footer a[target="_blank"]');
    await expect(social.filter({ hasText: 'Discord' })).toBeVisible();
    await expect(social.filter({ hasText: 'Twitter' })).toBeVisible();
    await expect(social.filter({ hasText: 'GitHub' })).toBeVisible();
  });
});
