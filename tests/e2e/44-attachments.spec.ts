import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

/**
 * C2 — Attachments reach the model. The composed user turn embeds the real file
 * content (so it becomes the visible user message AND the model context — no
 * special path), the 24k attach budget blocks over-size sends honestly, and
 * images get an honest no-vision note instead of faked vision. Model-reply
 * content-fidelity is the founder's spot-check; here we prove the content enters
 * the turn deterministically.
 */

const MD_CONTENT = '# Reisenotizen\n\nDie Hauptstadt von Portugal ist Lissabon. Kaffee kostet 0,80 Euro.';

test.describe('Chat attachments', { tag: '@local-only' }, () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  async function openChat(page: import('@playwright/test').Page) {
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await page.locator('textarea[data-chat-input]').first().waitFor({ state: 'visible', timeout: 15000 });
  }

  test('a .md attachment is read and its content enters the sent turn', async ({ page }) => {
    await openChat(page);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'reise.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(MD_CONTENT, 'utf-8'),
    });
    await expect(page.locator('[data-testid="composer-attachment"]')).toContainText('reise.md');

    const textarea = page.locator('textarea[data-chat-input]').first();
    await textarea.fill('fasse die angehängte Datei zusammen');
    await textarea.press('Enter');

    // The composed user turn must contain the real file content.
    await expect(page.locator('text=Lissabon').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Angehängte Datei: reise.md').first()).toBeVisible();
  });

  test('an over-budget attachment is blocked before send (honest error, no silent truncation)', async ({ page }) => {
    await openChat(page);
    const big = 'x'.repeat(25_000);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'gross.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(big, 'utf-8'),
    });
    await expect(page.locator('[data-testid="composer-attachment"]')).toContainText('gross.txt');

    const textarea = page.locator('textarea[data-chat-input]').first();
    await textarea.fill('fasse zusammen');
    await textarea.press('Enter');

    // Honest budget error, and nothing was sent (attachment chip still present).
    await expect(page.locator('text=/zu groß|24.?000/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="composer-attachment"]')).toBeVisible();
  });

  test('an image attachment yields an honest no-vision note, not faked vision', async ({ page }) => {
    await openChat(page);
    // 1x1 PNG.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('[data-testid="composer-attachment"]')).toContainText('foto.png');

    const textarea = page.locator('textarea[data-chat-input]').first();
    await textarea.fill('was ist auf dem Bild?');
    await textarea.press('Enter');

    await expect(page.locator('text=/Bilder kann ich noch nicht ansehen/i').first()).toBeVisible({ timeout: 8000 });
  });
});
