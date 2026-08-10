/**
 * WAVE-ABOUT-MANIFESTO — rendered proof for /about and /manifesto.
 *
 * Covers the gate matrix: 375px (the design's first target), 320px (the floor),
 * and desktop; light and dark; and both locale settings — the DE runs write the
 * explicit-choice key (lib/locale.ts precedence 1) before load, which is exactly
 * what the DE·EN switcher writes.
 *
 * FOLLOW-UP (founder decision 2026-08-10): the DE shots are now expected to show
 * the page ENTIRELY IN ENGLISH — chrome included. The earlier cut translated the
 * back link and eyebrow above English prose, which read as a broken translation
 * rather than a declared gap. Photographing the DE runs is still the point: they
 * are the proof that a visitor who pressed DE gets a coherent English page and
 * not a half-translated one.
 *
 * `<html lang>` is therefore 'en' on every run, including the DE ones — the
 * document declares the language it is actually written in. That is asserted in
 * tests/e2e/34-lang-switcher.spec.ts; here it is only the readiness signal we
 * wait on before the screenshot.
 *
 *   node evidence/about-manifesto/shots.mjs [baseURL]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = dirname(fileURLToPath(import.meta.url));

const VIEWPORTS = [
  { name: '375', width: 375, height: 812, isMobile: true },
  { name: '320', width: 320, height: 640, isMobile: true },
  { name: 'desktop', width: 1440, height: 1000, isMobile: false },
];
const PAGES = ['about', 'manifesto'];
const THEMES = ['light', 'dark'];
const LOCALES = ['en', 'de'];

mkdirSync(OUT, { recursive: true });

// PLAYWRIGHT_CHROMIUM_PATH lets a runner point at a Chromium it already has
// (this repo's @playwright/test pin and the sandbox's pre-installed build are
// different revisions). Unset → Playwright's own managed browser, as usual.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let n = 0;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
      });
      // Seed BOTH switches the way a real visitor's browser would carry them:
      // `goblin-theme` is what the landing's pre-paint script reads,
      // `goblin:lang-choice` is precedence 1 of the locale chain.
      await context.addInitScript(
        ([t, l]) => {
          localStorage.setItem('goblin-theme', t);
          localStorage.setItem('goblin:lang-choice', l);
        },
        [theme, locale],
      );

      for (const path of PAGES) {
        const page = await context.newPage();
        await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle' });
        // The language resolves in an effect on mount; wait for the DOM to carry
        // it rather than sleeping a guessed number of milliseconds. It is 'en'
        // for both locale settings while the German is outstanding — see the
        // header. When PROSE_GERMAN_READY flips, change this to `locale` and the
        // DE shots start showing German.
        await page.waitForFunction(() => document.documentElement.lang === 'en');
        const file = join(OUT, `${path}-${vp.name}-${theme}-${locale}.png`);
        await page.screenshot({ path: file, fullPage: true });
        n += 1;
        console.log(`  ${String(n).padStart(2)} ${file.replace(`${OUT}/`, '')}`);
        await page.close();
      }
      await context.close();
    }
  }
}

await browser.close();
console.log(`\n${n} shots written to ${OUT}`);
