import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.describe('@auth 9D-4 API Keys', () => {
  test('Page lists 8 providers in settings sheet', async ({ page, isMobile }) => {
    await loginAsRealTestUser(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    if (isMobile) {
      await page.click('[data-testid="mobile-hamburger"]');
      await page.waitForTimeout(300);
      await page.click('[data-testid="user-pill"]');
    } else {
      await page.click('[data-testid="user-pill-desktop"]');
    }
    await page.click('[data-testid="row-api-keys"]');

    for (const provider of ['anthropic', 'openai', 'google', 'mistral', 'groq', 'together', 'deepseek', 'fireworks']) {
      await expect(page.locator(`[data-testid="provider-${provider}"]`)).toBeVisible({ timeout: 8000 });
    }
  });
});
