// P1.1 chat dark evidence. Opens an existing project-bound session, sends a
// tiny prompt to elicit a code/file card, screenshots at 375 + 1440 dark.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const SESSION = '132a6979-833e-4347-a45b-6866f24c490e';
const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1440', width: 1440, height: 1200 },
];

const browser = await chromium.launch();
const out = [];
try {
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await loginContext(browser, { width: vp.width, height: vp.height, theme: 'dark' });
    page.setDefaultNavigationTimeout(150000);
    await page.goto(`${BASE}/dashboard/chat/${SESSION}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
    const ta = page.locator('textarea').last();
    await ta.waitFor({ timeout: 60000 }).catch(() => {});
    // baseline composer shot
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/p11-chat-composer-dark-${vp.name}.png` });

    // try a real send to produce a message + code card
    let sent = false;
    try {
      await ta.click();
      await ta.fill('Schreibe eine minimale hello.html mit einem <h1>Hallo</h1>. Nur den Code.');
      await page.keyboard.press('Enter');
      sent = true;
      // wait for an assistant response / code block to appear
      await page.waitForFunction(() => {
        const t = document.body.innerText || '';
        return /html|<h1|Hallo|```|hello/i.test(t) && document.querySelectorAll('pre, code').length > 0;
      }, { timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2000);
    } catch (e) {
      out.push({ vp: vp.name, sendErr: e.message });
    }
    await page.screenshot({ path: `${OUT}/p11-chat-messages-dark-${vp.name}.png`, fullPage: true });
    const info = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      body: getComputedStyle(document.body).backgroundColor,
      preCount: document.querySelectorAll('pre, code').length,
      bubbles: document.querySelectorAll('[data-role], .message, [class*="message" i]').length,
      err: /Fehler|kein Modell|no model|api key/i.test(document.body.innerText || ''),
    }));
    out.push({ vp: vp.name, sent, ...info });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
