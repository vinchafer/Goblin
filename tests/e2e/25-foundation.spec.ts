import { test, expect } from '@playwright/test';

test.describe('@public 9D-0 Foundation', () => {
  test('Tokens loaded — moss + new 9D tokens resolve', async ({ page }) => {
    await page.goto('/');
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        moss: s.getPropertyValue('--moss').trim(),
        mossSoft: s.getPropertyValue('--moss-green-soft').trim(),
        toggleOff: s.getPropertyValue('--toggle-off').trim(),
        radiusSheet: s.getPropertyValue('--radius-sheet').trim(),
      };
    });
    expect(tokens.moss.toLowerCase()).toBe('#2d4a2b');
    expect(tokens.mossSoft).toMatch(/rgba\(45,\s*74,\s*43,\s*0\.08\)/);
    expect(tokens.toggleOff).toMatch(/rgba\(120,\s*120,\s*128,\s*0\.16\)/);
    expect(tokens.radiusSheet).toBe('24px');
  });
});
