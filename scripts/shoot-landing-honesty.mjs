/**
 * Landing honesty-pass renders (TESTER-FEEDBACK wave, 2026-08-17).
 *
 * Shoots the sections the wave touched at 375px and desktop, in light AND dark,
 * so the PR carries pictures of what changed rather than a claim that it looks
 * fine. Nothing here is a test — it produces evidence a human then looks at.
 *
 *   node scripts/shoot-landing-honesty.mjs            # against localhost:3112
 *   SHOT_BASE_URL=… SHOT_OUT=… node scripts/shoot-landing-honesty.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.SHOT_BASE_URL || 'http://localhost:3113';
const OUT = process.env.SHOT_OUT || join(process.cwd(), 'evidence/landing-honesty-2026-08-17');

// Each entry: a selector that must exist, and the file stem for its shot.
const TARGETS = [
  { name: 'install-ai-location', sel: '.ai-location' },
  { name: 'how-it-works', sel: '#how' },
  { name: 'product-phone', sel: '.stc' },
  { name: 'phone-frame', sel: '.pm-frame' },
  { name: 'island-flow', sel: '.island' },
  { name: 'pricing', sel: '#pricing' },
];

const VIEWPORTS = [
  { name: '375', width: 375, height: 900, dpr: 2 },
  { name: 'desktop', width: 1440, height: 900, dpr: 2 },
];

mkdirSync(OUT, { recursive: true });

// SHOT_CHROMIUM lets a sandbox whose installed browser revision differs from the
// repo's pinned @playwright/test point at the build it actually has. CI, which
// has the pinned revision, sets nothing and gets Playwright's own resolution.
const browser = await chromium.launch(
  process.env.SHOT_CHROMIUM ? { executablePath: process.env.SHOT_CHROMIUM } : {},
);
let shot = 0;
let missing = 0;

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
    });
    // The landing reads its theme from localStorage before first paint.
    await ctx.addInitScript(`try { localStorage.setItem('goblin-theme', '${theme}'); } catch (e) {}`);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    // The install block and the send-to-code illustration are client-mounted.
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    for (const t of TARGETS) {
      const el = page.locator(t.sel).first();
      if ((await el.count()) === 0) {
        console.log(`MISSING  ${t.sel}  (${vp.name}/${theme})`);
        missing += 1;
        continue;
      }
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const file = `${t.name}-${vp.name}-${theme}.png`;
      await el.screenshot({ path: join(OUT, file) });
      console.log(`ok  ${file}`);
      shot += 1;
    }
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${shot} shots written to ${OUT}${missing ? ` — ${missing} selector(s) missing` : ''}`);
if (missing) process.exitCode = 1;
