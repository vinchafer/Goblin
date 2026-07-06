import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const browser = await chromium.launch();
try {
  const { page } = await loginContext(browser, { width: 1440, height: 900, theme: 'dark' });
  console.log('url after login:', page.url());
  // wait for real dashboard content (past the loading splash)
  await page.waitForURL(/\/dashboard/, { timeout: 90000 }).catch(() => {});
  await page.waitForFunction(() => !/wird geladen/i.test(document.body.innerText || ''), { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/smoke-dashboard-dark-1440.png`, fullPage: false });
  // sample computed bg of shell to prove dark flip
  const bg = await page.evaluate(() => {
    const el = document.querySelector('[data-theme]') || document.documentElement;
    const theme = document.documentElement.getAttribute('data-theme');
    const body = getComputedStyle(document.body).backgroundColor;
    return { theme, body };
  });
  console.log('THEME/BG:', JSON.stringify(bg));
  console.log('OK');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
