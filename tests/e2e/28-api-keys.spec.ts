import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.describe('@auth 9D-4 API Keys', () => {
  test('Page lists 8 providers in settings sheet', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await page.locator('[data-testid="header-avatar"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.click('[data-testid="header-avatar"]');
    await page.click('[data-testid="avatar-menu-settings"]');
    await page.click('[data-testid="row-api-keys"]');

    for (const provider of ['anthropic', 'openai', 'google', 'mistral', 'groq', 'together', 'deepseek', 'fireworks']) {
      await expect(page.locator(`[data-testid="provider-${provider}"]`)).toBeVisible({ timeout: 8000 });
    }
  });
});
