import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

test.describe('@auth 9D-4 API Keys', () => {
  test('Page lists 8 providers in settings sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsRealTestUser(page);
    await page.goto('/dashboard');
    await page.click('button:has-text("Einstellungen"), [aria-label*="Einstellungen" i]');
    await page.click('[data-testid="row-api-keys"]');

    for (const provider of ['anthropic', 'openai', 'google', 'mistral', 'groq', 'together', 'deepseek', 'fireworks']) {
      await expect(page.locator(`[data-testid="provider-${provider}"]`)).toBeVisible({ timeout: 5000 });
    }
  });
});
