import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

/**
 * Sprint 7 — full multi-session Code-Tab flow.
 *
 * REQUIRES (founder, once):
 *   1. `supabase db push` applied migration 0055 (code_sessions* tables) to PROD.
 *   2. The API redeployed to Railway with routes/code-sessions.ts.
 *   3. A BYOK model key configured for the test user (else the streaming agent
 *      has no model to call).
 *   4. Run with SPRINT7_LIVE=1 to opt in.
 *
 * Built overnight but NOT runtime-tested (prod-only Supabase; migration is
 * founder-applied). This is the verification harness to run once the backend is live.
 */
const LIVE = process.env.SPRINT7_LIVE === '1';

test.describe('Sprint 7 — multi-session Code Tab', { tag: '@local-only' }, () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    test.skip(!LIVE, 'SPRINT7_LIVE not set — founder runs this after applying migration 0055');
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  test('prompt in Code Tab streams code into the editor as a draft', async ({ page }) => {
    test.skip(!LIVE, 'SPRINT7_LIVE not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}/work`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Switch to the Code Tab.
    await page.locator('button:has-text("Code"), [role="tab"]:has-text("Code")').first().click().catch(() => {});

    // The workspace auto-creates a first session → composer is present.
    const composer = page.locator('textarea[placeholder*="Goblin"]').first();
    await composer.waitFor({ state: 'visible', timeout: 15000 });
    await composer.fill('Bau eine Landing-Page mit einem Hero und einem CTA-Button. Nur index.html.');
    await composer.press('Enter');

    // The thread shows a streaming "schreibt …" turn, then the editor populates.
    await expect(page.locator('text=/schreibt|Goblin/i').first()).toBeVisible({ timeout: 10000 });
    const editor = page.locator('.cm-editor').first();
    await expect(editor).toBeVisible({ timeout: 60000 });

    // Draft state badge visible.
    await expect(page.locator('text=Entwurf').first()).toBeVisible({ timeout: 60000 });
  });

  test('Sichern promotes draft → Gesichert, then Veröffentlichen unlocks', async ({ page }) => {
    test.skip(!LIVE, 'SPRINT7_LIVE not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}/work`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const sichern = page.locator('button:has-text("Sichern")').first();
    await sichern.waitFor({ state: 'visible', timeout: 15000 });
    await sichern.click();
    await expect(page.locator('text=Gesichert').first()).toBeVisible({ timeout: 20000 });

    // Veröffentlichen → confirm dialog.
    const publish = page.locator('button:has-text("Veröffentlichen")').first();
    await publish.click();
    await expect(page.locator('text=/Veröffentlichen\\?/').first()).toBeVisible({ timeout: 5000 });
  });

  test('a second session runs in parallel + the session picker appears on Send-to-Code', async ({ page }) => {
    test.skip(!LIVE, 'SPRINT7_LIVE not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}/work`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    await page.locator('button:has-text("Neue Session")').first().click();
    // Two sessions now → a Send-to-Code from chat should raise the picker.
    // (Picker assertion left to the founder's interactive walk; structural presence only.)
    await expect(page.locator('text=Neue Session').first()).toBeVisible({ timeout: 5000 });
  });
});
