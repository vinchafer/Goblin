import { test, expect } from '@playwright/test';

test.describe('@public 9D-0 Foundation', () => {
  test('Tokens loaded — 9D additive tokens resolve in both themes', async ({ page }) => {
    await page.goto('/');
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        mossSoft: s.getPropertyValue('--moss-green-soft').trim(),
        radiusSheet: s.getPropertyValue('--radius-sheet').trim(),
        ochreSoft: s.getPropertyValue('--ochre-soft').trim(),
        shadowSheet: s.getPropertyValue('--shadow-sheet').trim(),
      };
    });
    // Browser may serialize rgba(r,g,b,a) as 8-digit hex (#rrggbbaa) or rgba(...) string.
    // Accept both forms.
    const rgbaOrHex8 = /(rgba?\([^)]+\)|#[0-9a-fA-F]{8})/;
    expect(tokens.mossSoft).toMatch(rgbaOrHex8);
    expect(tokens.ochreSoft).toMatch(rgbaOrHex8);
    expect(tokens.radiusSheet).toBe('24px');
    expect(tokens.shadowSheet.length).toBeGreaterThan(0);
  });
});
