// Screenshots the WAVE-J Hilfe/feedback/chat render at 375px in light + dark.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const htmlPath = fileURLToPath(new URL('../evidence/wave-j-support/hilfe-render.html', import.meta.url));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath);
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  const out = fileURLToPath(new URL(`../evidence/wave-j-support/hilfe-375px-${theme}.png`, import.meta.url));
  await page.screenshot({ path: out, fullPage: true });
  console.log('wrote', out);
  await page.close();
}
await browser.close();
