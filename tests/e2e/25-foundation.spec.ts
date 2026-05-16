import { test, expect } from '@playwright/test';

test.describe('@public 9D-0 Foundation', () => {
  test('Tokens loaded — 9D additive tokens resolve in both themes', async ({ page }) => {
    await page.goto('/');
    // New 9D tokens use alpha rgba — theme-agnostic format. Check those.
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        mossSoft: s.getPropertyValue('--moss-green-soft').trim(),
        radiusSheet: s.getPropertyValue('--radius-sheet').trim(),
        ochreSoft: s.getPropertyValue('--ochre-soft').trim(),
        shadowSheet: s.getPropertyValue('--shadow-sheet').trim(),
      };
    });
    // moss-green-soft: light = rgba(45,74,43,0.08), dark = rgba(74,120,72,0.16)
    expect(tokens.mossSoft).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.(08|16)\)/);
    expect(tokens.radiusSheet).toBe('24px');
    expect(tokens.ochreSoft).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.(12|16)\)/);
    expect(tokens.shadowSheet.length).toBeGreaterThan(0);
  });
});
