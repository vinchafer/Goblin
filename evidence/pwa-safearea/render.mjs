// Renders the SAFEAREA-U1 before/after harness to PNG. See harness.html for the
// honest-limit note (env() is simulated at 47px; real device = founder's gate).
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const htmlPath = fileURLToPath(new URL('./harness.html', import.meta.url));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 2 });
await page.goto('file://' + htmlPath);
const out = fileURLToPath(new URL('./header-before-after.png', import.meta.url));
await page.screenshot({ path: out, fullPage: true });
console.log('wrote', out);
await browser.close();
