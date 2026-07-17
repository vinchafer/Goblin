/**
 * WAVE C · WORKSPACE-1 §6 acceptance — the Explorer at 375px.
 *
 * Spec §6 (verbatim): "create a folder, create+edit+save an md file in it, attach
 * it to chat, ask Goblin about it, rename it, trash it, restore it, download the
 * project as zip — every step feeling native at 375px. That checklist IS the E2E gate."
 *
 * STATUS: authored in the Wave-C build session but NOT executed there (that
 * container has no browser/prod/Supabase secrets). It is tagged @local-only so it
 * never runs in the default CI projects, and is the harness for the founder's prod
 * 375px acceptance walk (founder-action list). The real-model "ask Goblin" leg is
 * deliberately the prod founder step — this spec asserts the file is ATTACHED to the
 * composer (deterministic) and stops short of spending on a live model send.
 *
 * Run locally: NEXT_PUBLIC_ENABLE_TEST_AUTH=true + the usual TEST_ACCOUNT_* /
 * SUPABASE_* env, then `pnpm exec playwright test tests/e2e/47-workspace-explorer.spec.ts --project=auth-mobile`.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestCallback, resolveTestProjectId } from './helpers/auth';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const FOLDER = 'wave-c-akzeptanz';
const FILE = 'notiz.md';
const RENAMED = 'notiz-final.md';

test.describe('@local-only Wave C — Explorer acceptance @375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('folder → md create+edit+save → attach → rename → trash → restore → zip', async ({ page }) => {
    await loginAsTestCallback(page);
    const projectId = await resolveTestProjectId(page);
    await page.goto(`${BASE}/dashboard/project/${projectId}/files`);
    await expect(page.getByTestId('fx-new-folder')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'test-results/wave-c/01-explorer.png' });

    // 1) Create a folder
    await page.getByTestId('fx-new-folder').click();
    await page.getByTestId('fx-name-input').fill(FOLDER);
    await page.getByTestId('fx-name-submit').click();
    await expect(page.getByText(FOLDER, { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/wave-c/02-folder.png' });

    // Enter the folder
    await page.getByText(FOLDER, { exact: true }).click();

    // 2) Create + edit + save an md file (Markdown template opens in the editor)
    await page.getByTestId('fx-new-file').click();
    await page.getByRole('button', { name: 'Markdown' }).click();
    await page.getByTestId('fx-name-input').fill(FILE);
    await page.getByTestId('fx-name-submit').click();
    await expect(page.getByTestId('fx-save')).toBeVisible(); // opened straight in the editor
    // Edit the content in the reused CodeEditor (CodeMirror), then save.
    await page.locator('.cm-content').click();
    await page.keyboard.type('\nAkzeptanz-Notiz mit Ümlaut.');
    await page.getByTestId('fx-save').click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await page.screenshot({ path: 'test-results/wave-c/03-edit-save.png' });

    // 3) Attach to chat (routes into the C2 attach path). Assert the file lands as an
    //    attachment chip in the project chat composer.
    await page.getByLabel('Datei-Aktionen').first().click();
    await page.getByTestId('attach-to-chat').click();
    await page.waitForURL(/\/work\?tab=chat/, { timeout: 20000 });
    await expect(page.getByText(FILE)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/wave-c/04-attached.png' });
    // 4) Ask Goblin about it → PROD FOUNDER LEG (real model + test account). Not sent
    //    here to avoid autonomous spend; the founder performs this on the prod walk.

    // 5) Rename — back in the Explorer
    await page.goto(`${BASE}/dashboard/project/${projectId}/files`);
    await page.getByText(FOLDER, { exact: true }).click();
    await page.getByLabel('Datei-Aktionen').first().click();
    await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
    await page.getByTestId('fx-name-input').fill(RENAMED);
    await page.getByTestId('fx-name-submit').click();
    await expect(page.getByText(RENAMED, { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/wave-c/05-rename.png' });

    // 6) Trash (soft-delete)
    await page.getByLabel('Datei-Aktionen').first().click();
    await page.getByRole('menuitem', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Löschen' }).click(); // confirm dialog
    await expect(page.getByText('Gelöscht')).toBeVisible();
    await page.screenshot({ path: 'test-results/wave-c/06-trash.png' });

    // 7) Restore from the Papierkorb
    await page.getByTestId('open-trash').click();
    await expect(page.getByTestId('restore-file').first()).toBeVisible();
    await page.getByTestId('restore-file').first().click();
    await expect(page.getByText('Wiederhergestellt')).toBeVisible();
    await page.screenshot({ path: 'test-results/wave-c/07-restore.png' });

    // 8) Download the project as ZIP
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByTestId('download-zip').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    await page.screenshot({ path: 'test-results/wave-c/08-zip.png' });
  });
});
