// Renders the SAFEAREA-U1 before/after harness to PNG. See harness.html for the
// honest-limit note (env() is simulated at 47px; real device = founder's gate).
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function shot(html, out, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto('file://' + fileURLToPath(new URL(html, import.meta.url)));
  const outPath = fileURLToPath(new URL(out, import.meta.url));
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('wrote', outPath);
  await page.close();
}

// U1 — header safe-area before/after
await shot('./harness.html', './header-before-after.png', { width: 900, height: 720 });
// U4 — install-hint platform states (no phantom iOS button)
await shot('./install-hint-harness.html', './install-hint-states.png', { width: 470, height: 400 });

await browser.close();
