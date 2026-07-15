/**
 * FW5 evidence screenshots — public surfaces we can render headless.
 * Uses the preinstalled Chromium. Captures /help (U4 agent-first) at 375px.
 */
import pkg from '/home/user/Goblin/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.js';
import { mkdirSync } from 'node:fs';
const { chromium } = pkg;

const OUT = '/home/user/Goblin/evidence/fw5-shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || 'http://localhost:3300';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  // U4 — /help agent-first, 375px (mobile). Assert no plaintext support email link.
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await page.goto(`${BASE}/help`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  const mailtoCount = await page.locator('a[href="mailto:support@justgoblin.com"]').count();
  const emailLinkCount = await page.getByRole('link', { name: /support@justgoblin\.com/i }).count();
  const agentCta = await page.getByRole('button', { name: /Goblin.?(Hilfe|help)/i }).count();
  await page.screenshot({ path: `${OUT}/u4-help-375.png`, fullPage: true });
  console.log(JSON.stringify({ surface: '/help@375', mailtoCount, emailLinkCount, agentCta }, null, 2));
  await page.close();

  // U1 F-12 — gold "send to code" affordance: header pill + repeat at file end.
  for (const w of [375, 720]) {
    const p = await browser.newPage({ viewport: { width: w, height: 1000 } });
    await p.goto(`${BASE}/demo-fw5codeblock`, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(500);
    const header = await p.locator('[data-testid="cb-add-to-project"]').count();
    const end = await p.locator('[data-testid="cb-add-to-project-end"]').count();
    await p.screenshot({ path: `${OUT}/u1-f12-codeblock-${w}.png`, fullPage: true });
    console.log(JSON.stringify({ surface: `/demo-fw5codeblock@${w}`, headerAffordances: header, fileEndAffordances: end }));
    await p.close();
  }
} finally {
  await browser.close();
}
console.log('shots done');
