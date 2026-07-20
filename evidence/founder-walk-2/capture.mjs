// FOUNDER-WALK-2 render capture — screenshots the standalone harnesses at 375px
// in BOTH themes. Uses the pre-installed Chromium (PLAYWRIGHT_BROWSERS_PATH).
// Run: node evidence/founder-walk-2/capture.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const dir = fileURLToPath(new URL('.', import.meta.url));
const shots = [
  { file: 'harness-admin-nav.html', name: 'u1-admin-nav', width: 375, height: 200 },
  { file: 'harness-tour-popup.html', name: 'u3-tour-popup', width: 375, height: 640 },
  // U2 (install note) and U4 (onboarding before/after) use their own param-driven
  // capture scripts (cap-u2.mjs / cap-u4.mjs) since they vary lang / before-after.
];

// The pinned @playwright/test build differs from the pre-installed browser;
// point at the on-disk Chromium per the environment's guidance.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
for (const s of shots) {
  if (!existsSync(dir + s.file)) { console.log('  skip (no harness):', s.file); continue; }
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    await page.goto('file://' + dir + s.file);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForTimeout(120);
    const out = `${dir}${s.name}-${theme}-375.png`;
    await page.screenshot({ path: out });
    console.log('  wrote', out.split('/').pop());
    await page.close();
  }
}
await browser.close();
console.log('done');
