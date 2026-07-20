import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const state of ['before','after']) for (const theme of ['light','dark']) {
  const page = await b.newPage({ viewport: { width: 375, height: 720 } });
  await page.goto(`file://${dir}harness-onboarding-chrome.html?state=${state}&theme=${theme}`);
  await page.waitForTimeout(120);
  const out = `${dir}u4-onboarding-${state}-${theme}-375.png`;
  await page.screenshot({ path: out });
  console.log('wrote', out.split('/').pop());
  await page.close();
}
await b.close();
