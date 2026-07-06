// P1.4 evidence: a generated (filename-less) Markdown document card in a project
// chat now offers "Ins Projekt übernehmen" → STC preview (NEU badge) → draft.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const SESSION = '132a6979-833e-4347-a45b-6866f24c490e'; // project-bound chat
const PROMPT = 'Antworte NUR mit einem Markdown-Codeblock (```markdown …```), '
  + 'der einen kurzen Projektbericht mit einer Überschrift und drei Stichpunkten '
  + 'enthält. Kein Dateiname, kein weiterer Text.';

const browser = await chromium.launch();
const out = {};
try {
  const { page } = await loginContext(browser, { width: 1440, height: 1000, theme: 'light' });
  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard/chat/${SESSION}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  const ta = page.locator('textarea').last();
  await ta.waitFor({ timeout: 90000 });
  await ta.fill(PROMPT);
  await page.keyboard.press('Enter');

  // 1) The document card exposes "Ins Projekt übernehmen" (the P1.4 fix).
  const stc = page.locator('[data-testid="cb-add-to-project"]').last();
  await stc.waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  out.übernehmenOnDocCard = await stc.isVisible();
  await page.screenshot({ path: `${OUT}/p14-doccard-uebernehmen.png`, fullPage: true });

  // 2) Click it → STC preview sheet with the NEU badge (integrity + badges).
  await stc.click();
  const sheet = page.locator('[data-testid="stc-preview-sheet"]');
  await sheet.waitFor({ timeout: 15000 });
  const neu = page.locator('[data-testid="stc-badge-new"]').first();
  await neu.waitFor({ timeout: 8000 }).catch(() => {});
  out.previewNeuBadge = await neu.isVisible().catch(() => false);
  out.previewFile = await page.locator('[data-testid="stc-preview-file"]').first().innerText().catch(() => null);
  await page.screenshot({ path: `${OUT}/p14-stc-preview-neu.png` });

  // 3) Confirm → routes to the Code surface with the .md as a draft.
  await page.locator('[data-testid="stc-preview-confirm"]').click();
  await page.waitForURL(/work\?tab=code|\/project\//, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const bodyTxt = await page.evaluate(() => document.body.innerText);
  out.codeHasMd = /\.md\b/i.test(bodyTxt);
  out.codeHasNeu = /\bNEU\b/.test(bodyTxt);
  await page.screenshot({ path: `${OUT}/p14-code-draft-neu.png`, fullPage: true });

  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
