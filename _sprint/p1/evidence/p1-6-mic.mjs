// P1.6 evidence: desktop mic honesty. Denied permission → specific unblock hint
// (not silence); granted → no blocked hint (proceeds down the dictation path).
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const SESSION = '132a6979-833e-4347-a45b-6866f24c490e';
const BLOCKED_DE = /Mikrofon ist blockiert/i;

async function run(browser, setting) {
  const { ctx, page } = await loginContext(browser, { width: 1280, height: 900, theme: 'light' });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Browser.setPermission', {
    origin: BASE,
    permission: { name: 'microphone' },
    setting, // 'denied' | 'granted'
  }).catch((e) => ({ err: e.message }));
  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard/chat/${SESSION}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  const mic = page.locator('[data-testid="composer-mic"]');
  await mic.waitFor({ timeout: 90000 });
  await mic.click();
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const blockedShown = BLOCKED_DE.test(bodyText);
  const micStatus = await mic.getAttribute('data-mic-status');
  await page.screenshot({ path: `${OUT}/p16-mic-${setting}.png` });
  await ctx.close();
  return { setting, blockedShown, micStatus };
}

const browser = await chromium.launch();
const out = {};
try {
  out.denied = await run(browser, 'denied');
  out.granted = await run(browser, 'granted');
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
