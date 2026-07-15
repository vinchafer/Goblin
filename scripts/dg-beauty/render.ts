/**
 * WAVE D-G — LOCAL render of each generated archetype (Gesetz: local file renders work
 * even when headless-external gates fail). Screenshots each app at 375px (mobile) and
 * 1280px (desktop), full page, from a file:// URL. Google-Fonts <link>s load if the
 * network allows; if they 404 the page still renders with fallbacks (screenshot never
 * hangs on external fonts).
 *
 * Usage: tsx scripts/dg-beauty/render.ts <before|after>
 */
// pnpm isolated store: require playwright-core by its absolute store path.
import { createRequire } from 'node:module';
const _req = createRequire('/home/user/Goblin/');
const { chromium } = _req(
  '/home/user/Goblin/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core',
) as typeof import('playwright-core');
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

async function main() {
  const phase = process.argv[2] || 'after';
  const root = join('evidence', 'dg-beauty', phase);
  const archetypes = readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory() && n !== 'register').sort();

  // Pre-installed Chromium (revision may differ from Playwright's pin) — launch it by path.
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  for (const a of archetypes) {
    const dir = join(root, a);
    const index = join(dir, 'index.html');
    if (!existsSync(index)) {
      console.log(`[skip] ${a}: no index.html`);
      continue;
    }
    const url = 'file://' + resolve(index);
    for (const [w, tag] of [[375, '375'], [1280, 'desktop']] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500); // let webfonts + any DOMContentLoaded JS settle
        await page.screenshot({ path: join(root, `${a}-${tag}.png`), fullPage: true });
        console.log(`[${phase}] ${a} @${w} → ${a}-${tag}.png`);
      } finally {
        await page.close();
      }
    }
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
