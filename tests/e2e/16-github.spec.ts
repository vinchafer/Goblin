import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('GitHub Integration', { tag: '@local-only' }, () => {
  test('integrations settings page loads', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/settings/integrations`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('GitHub section is visible on integrations page', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/settings/integrations`);
    await page.waitForLoadState('networkidle');

    // GitHub heading or connect/disconnect button should be visible
    const githubHeading = page.locator('h3:has-text("GitHub"), text="GitHub"').first();
    const connectBtn = page.locator('button:has-text("Connect GitHub")').first();
    const disconnectBtn = page.locator('button:has-text("Disconnect")').first();
    const connectedText = page.locator('text=/Connected as|✓ Connected/').first();

    const hasHeading = await githubHeading.isVisible({ timeout: 8000 }).catch(() => false);
    const hasConnect = await connectBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasDisconnect = await disconnectBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const hasConnected = await connectedText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasHeading || hasConnect || hasDisconnect || hasConnected).toBe(true);
  });

  test('GitHub connect initiates OAuth redirect (does NOT complete — just checks redirect)', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/settings/integrations`);
    await page.waitForLoadState('networkidle');

    const connectBtn = page.locator('button:has-text(/Connect GitHub/i)').first();
    const isVisible = await connectBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({ type: 'note', description: 'GitHub already connected or connect button not found' });
      return;
    }

    // Intercept the navigation — don't actually complete GitHub OAuth
    let oauthRedirectDetected = false;
    page.on('request', (req) => {
      if (req.url().includes('github.com') || req.url().includes('/api/github/oauth')) {
        oauthRedirectDetected = true;
      }
    });

    await connectBtn.click();
    await page.waitForTimeout(2000);

    // Either we detected a GitHub redirect, or the URL changed to a GitHub OAuth page
    const currentUrl = page.url();
    const redirectedToGithub = currentUrl.includes('github.com');

    expect(oauthRedirectDetected || redirectedToGithub).toBe(true);
  });
});
