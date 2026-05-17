import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.describe('@auth 9P Models Settings', () => {
  test('Modelle row opens 3-tab page with Rankings/Meine Keys/Erweitert', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await page.locator('[data-testid="header-avatar"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.click('[data-testid="header-avatar"]');
    await page.click('[data-testid="avatar-menu-settings"]');

    const modelsRow = page.locator('[data-testid="row-models"]');
    await expect(modelsRow).toBeVisible({ timeout: 5000 });
    await modelsRow.click();

    // 3 tabs visible
    await expect(page.locator('[data-testid="models-tab-rankings"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="models-tab-keys"]')).toBeVisible();
    await expect(page.locator('[data-testid="models-tab-advanced"]')).toBeVisible();

    // Tab "Meine Keys" — at least 5 core providers
    await page.click('[data-testid="models-tab-keys"]');
    for (const name of ['Anthropic', 'OpenAI', 'Google', 'Groq', 'Mistral']) {
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });
    }

    // Tab "Rankings" — model row visible OR empty-state if 9R-refresh has not run
    await page.click('[data-testid="models-tab-rankings"]');
    const rankingsLoading = page.locator('text=/Lade Rankings/');
    if (await rankingsLoading.isVisible().catch(() => false)) {
      await rankingsLoading.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    }
    const emptyState = page.locator('text=/Noch keine Daten/');
    const anyModelRow = page.locator('text=/#1/');
    const hasModels = await anyModelRow.first().isVisible().catch(() => false);
    const isEmpty = await emptyState.first().isVisible().catch(() => false);
    expect(hasModels || isEmpty).toBeTruthy();
    if (isEmpty) test.info().annotations.push({ type: 'info', description: 'Rankings empty — 9R refresh has not run yet' });
  });
});
