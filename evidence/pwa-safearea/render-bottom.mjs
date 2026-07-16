// Renders the SAFEAREA-U-BOTTOM before/after harness to PNG (portrait +
// landscape both live in the one harness). See harness-bottom.html for the
// honest-limit note (env() is simulated at 34px; real device = founder's gate).
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });

async function shot(html, out, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto('file://' + fileURLToPath(new URL(html, import.meta.url)));
  const outPath = fileURLToPath(new URL(out, import.meta.url));
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('wrote', outPath);
  await page.close();
}

await shot('./harness-bottom.html', './bottom-before-after.png', { width: 1120, height: 1000 });

await browser.close();
