// WAVE-KORREKTUR-1 · U2 — screenshots of the DE · EN switcher on the REAL app
// (not a harness): the running checkout at 320 / 375 / 1280 px, light + dark, in
// both locales. Composited into two contact sheets.
//
//   node evidence/public-i18n/shots.mjs        (BASE=http://localhost:3100)
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:3100';
const dir = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(dir, { recursive: true });

const candidates = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
];
const executablePath = candidates.find(existsSync);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

async function shot({ name, path: url, width, height, theme, choice, clip }) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US' });
  await ctx.addInitScript(
    ([t, c]) => {
      localStorage.setItem('goblin-theme', t);
      if (c) localStorage.setItem('goblin:lang-choice', c);
    },
    [theme, choice],
  );
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const out = dir + name + '.png';
  if (clip) {
    // Tight element shot — unambiguous evidence, no scroll-position ambiguity.
    const el = page.locator(clip).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: out });
  } else {
    await page.screenshot({ path: out });
  }
  console.log('wrote', out);
  await ctx.close();
}

// Landing — the switcher lives in the NAV ≥861px and in the FOOTER ≤860px.
await shot({ name: 'landing-nav-desktop-light', path: '/', width: 1280, height: 420, theme: 'light', clip: 'nav.lp-nav' });
await shot({ name: 'landing-nav-desktop-dark',  path: '/', width: 1280, height: 420, theme: 'dark',  clip: 'nav.lp-nav' });
await shot({ name: 'landing-footer-375-light',  path: '/', width: 375, height: 700, theme: 'light', clip: 'footer.lp-footer' });
await shot({ name: 'landing-footer-375-dark',   path: '/', width: 375, height: 700, theme: 'dark',  clip: 'footer.lp-footer' });
await shot({ name: 'landing-footer-320-light',  path: '/', width: 320, height: 700, theme: 'light', clip: 'footer.lp-footer' });
await shot({ name: 'landing-footer-320-dark',   path: '/', width: 320, height: 700, theme: 'dark',  clip: 'footer.lp-footer' });
// The 320px nav itself — proof the switcher is NOT there and nothing collides.
await shot({ name: 'landing-nav-320-light',     path: '/', width: 320, height: 320, theme: 'light', clip: 'nav.lp-nav' });
await shot({ name: 'landing-nav-320-dark',      path: '/', width: 320, height: 320, theme: 'dark',  clip: 'nav.lp-nav' });
await shot({ name: 'landing-nav-375-light',     path: '/', width: 375, height: 320, theme: 'light', clip: 'nav.lp-nav' });

// /login — the switcher in both locales, both themes, 320 + 375.
for (const [w, choice, theme] of [
  [375, 'en', 'light'], [375, 'de', 'light'],
  [375, 'en', 'dark'],  [375, 'de', 'dark'],
  [320, 'en', 'light'], [320, 'de', 'light'],
]) {
  await shot({ name: `login-${w}-${choice}-${theme}`, path: '/login', width: w, height: 720, theme, choice });
}

await browser.close();
