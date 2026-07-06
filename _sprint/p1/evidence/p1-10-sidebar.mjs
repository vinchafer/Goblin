// P1.10(b) evidence: the sidebar allowance label now reads "N % verbraucht"
// (unambiguous — percent consumed), not the bare "Kontingent 0 %".
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

async function shoot(browser, lang, name) {
  const { ctx, page } = await loginContext(browser, { width: 1280, height: 900, theme: 'light', lang });
  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.waitForFunction(() => !/wird geladen/i.test(document.body.innerText || ''), { timeout: 90000 }).catch(() => {});
  // The allowance widget fetches usage async; wait for the label text.
  await page.waitForFunction(
    () => /verbraucht|used/i.test(document.body.innerText || '') && /Kontingent|Allowance/i.test(document.body.innerText || ''),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(600);
  const labelText = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/(Kontingent|Allowance)[\s\S]{0,40}?(\d+)\s*%\s*(verbraucht|used)/i);
    return m ? m[0].replace(/\s+/g, ' ').trim() : null;
  });
  await page.screenshot({ path: `${OUT}/p110-sidebar-${name}.png`, fullPage: true });
  await ctx.close();
  return labelText;
}

const browser = await chromium.launch();
try {
  const de = await shoot(browser, 'de', 'de');
  const en = await shoot(browser, 'en', 'en');
  console.log(JSON.stringify({ de, en }, null, 1));
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
