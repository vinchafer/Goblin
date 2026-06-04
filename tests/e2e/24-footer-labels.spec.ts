import { test, expect } from '@playwright/test';

test.describe('9C — Footer social labels not single letters', { tag: '@public' }, () => {
  test('Footer social link shows a full text label (not a single letter)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Footer was reduced to a single real social destination (GitHub) in
    // feat(marketing): clean dead footer links (850d94a, 2026-05-31) — the
    // Discord/Twitter pills were placeholders with no destination and were
    // removed. The 9C intent that survives is: the social link must render as a
    // full-text label, never a single-letter icon.
    const social = page.locator('footer a[target="_blank"]');
    const github = social.filter({ hasText: 'GitHub' });
    await expect(github).toBeVisible();
    await expect(github).toHaveText(/GitHub/);
  });
});
