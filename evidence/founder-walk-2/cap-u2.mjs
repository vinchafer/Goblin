import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const lang of ['de','en']) for (const theme of ['light','dark']) {
  const page = await b.newPage({ viewport: { width: 375, height: 560 } });
  await page.goto(`file://${dir}harness-install-note.html?lang=${lang}&theme=${theme}`);
  await page.waitForTimeout(120);
  const out = `${dir}u2-install-note-${lang}-${theme}-375.png`;
  await page.screenshot({ path: out });
  console.log('wrote', out.split('/').pop());
  await page.close();
}
await b.close();
