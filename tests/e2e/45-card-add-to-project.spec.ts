import { test, expect } from '@playwright/test';
import { loginAsTestCallback as loginAsRealTestUser, resolveTestProjectId, createProjectChatSession, dismissTour } from './helpers/auth';

/**
 * C3 — per-card "Ins Projekt übernehmen". In a project-bound chat, each generated
 * file-card offers a single-file add that opens the same StcPreviewSheet as the
 * multi-file flow (P0.3 integrity + U2 GEÄNDERT/NEU/IDENTISCH classification).
 * Needs a real generating model → @local-only.
 */
const PROMPT = 'Erzeuge eine index.html mit einer Überschrift "Hallo". Nur eine Datei.';

test.describe('Per-card add-to-project', { tag: '@local-only' }, () => {
  let projectId: string;
  let chatId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await resolveTestProjectId(page);
    chatId = await createProjectChatSession(page, projectId);
    await page.close();
  });

  test('a generated file-card exposes add-to-project and opens the STC preview with a badge', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/chat/${chatId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea[data-chat-input]').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill(PROMPT);
    await textarea.press('Enter');

    // Wait for a file-card with the per-card add action to render.
    const addBtn = page.locator('[data-testid="cb-add-to-project"]').first();
    await expect(addBtn).toBeVisible({ timeout: 45000 });
    await addBtn.click();

    // The STC preview sheet shows a classification badge (changed / new / identical).
    const badge = page.locator(
      '[data-testid="stc-badge-changed"], [data-testid="stc-badge-new"], [data-testid="stc-badge-identical"]',
    );
    await expect(badge.first()).toBeVisible({ timeout: 8000 });
  });
});
