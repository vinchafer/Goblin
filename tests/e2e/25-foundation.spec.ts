import { test, expect } from '@playwright/test';

test.describe('@public 9D-0 Foundation', () => {
  test('Tokens loaded — 9D additive tokens resolve in both themes', async ({ page }) => {
    await page.goto('/');
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        radiusSheet: s.getPropertyValue('--radius-sheet').trim(),
        shadowSheet: s.getPropertyValue('--shadow-sheet').trim(),
      };
    });
    // NOTE: --moss-green-soft and --ochre-soft were 9D additive color tokens that
    // were retired in the brand-color refactor (refactor(brand): migrate hardcoded
    // colors, 2026-05-19). They are no longer defined and are referenced via var()
    // nowhere in the app — asserting them guarded nothing. The two surviving 9D
    // sheet tokens (--radius-sheet, --shadow-sheet) still back the BottomSheet UI,
    // so the foundation-tokens-resolve intent is preserved on those.
    expect(tokens.radiusSheet).toBe('24px');
    expect(tokens.shadowSheet.length).toBeGreaterThan(0);
  });
});
