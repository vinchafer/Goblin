import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

/**
 * C4 — downloads. Project ZIP (C4b) and the clean print-to-PDF view (C4c). The
 * per-card download (C4a) is covered by the deterministic print/download unit
 * behavior; here we drive the real ZIP endpoint and the print view.
 */

test.describe('Downloads', { tag: '@local-only' }, () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  test('C4b — "Projekt als ZIP" downloads a .zip', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}/files`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const zipBtn = page.locator('[data-testid="download-zip"]');
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      zipBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('C4c — the print view renders the document cleanly (375px + desktop)', async ({ page }) => {
    await loginAsRealTestUser(page);
    // Seed a document into the print stash, then open the clean print route.
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'goblin:print-doc',
        JSON.stringify({ title: 'Notiz', content: '# Titel\n\nEin **wichtiger** Absatz.', format: 'md' }),
      );
    });

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/print');
    await expect(page.locator('.print-doc h1')).toHaveText('Titel');
    await expect(page.locator('.print-doc strong')).toHaveText('wichtiger');
    // No horizontal overflow at 375.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(overflow).toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.print-doc h1')).toHaveText('Titel');
  });
});
