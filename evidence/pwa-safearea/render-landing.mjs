// WAVE-KORREKTUR-1 · U1 — renders the PUBLIC-LANDING safe-area before/after
// harness (and, once U2 lands, the DE/EN switcher placements) to PNG.
// See landing-harness.html for the honest-limit note: env() is simulated at 47px
// because headless Chromium reports 0; the real device is the founder's gate.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Reuse whichever Chromium this container ships (the path is pinned in
// render.mjs; keep working if the revision bumps).
const candidates = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
];
const executablePath = candidates.find(existsSync);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

async function shot(html, out, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto('file://' + fileURLToPath(new URL(html, import.meta.url)));
  const outPath = fileURLToPath(new URL(out, import.meta.url));
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('wrote', outPath);
  await page.close();
}

// U1 — landing header before/after, light + dark, 375px phone columns
await shot('./landing-harness.html', './landing-header-before-after.png', { width: 900, height: 800 });

// U2 — DE/EN switcher placements (nav on desktop, footer on mobile), both locales
if (existsSync(fileURLToPath(new URL('./lang-switcher-harness.html', import.meta.url)))) {
  await shot('./lang-switcher-harness.html', './lang-switcher-placements.png', { width: 980, height: 900 });
}

await browser.close();
