// P1.1 dark-mode evidence: dashboard, create-modal (typed), settings, chat
// at 375 + 1440, theme=dark. Honest logging of what actually rendered.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE, env } from './_lib.mjs';

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1440', width: 1440, height: 900 },
];

async function waitDash(page) {
  await page.waitForURL(/\/dashboard/, { timeout: 90000 }).catch(() => {});
  await page.waitForFunction(() => !/wird geladen/i.test(document.body.innerText || ''), { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1800);
}

async function bodyBg(page) {
  return page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    body: getComputedStyle(document.body).backgroundColor,
  }));
}

const browser = await chromium.launch();
const results = [];
try {
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await loginContext(browser, { width: vp.width, height: vp.height, theme: 'dark' });

    // 1) Dashboard
    await waitDash(page);
    await page.screenshot({ path: `${OUT}/p11-dashboard-dark-${vp.name}.png` });
    results.push({ shot: `dashboard-${vp.name}`, ...(await bodyBg(page)) });

    // 2) Create-project modal with typed text
    try {
      const plus = page.locator('[data-testid="sidebar-projects-plus"]').first();
      if (await plus.isVisible().catch(() => false)) {
        await plus.click();
      } else {
        // mobile: header "+" opens a menu; then click the "Neues Projekt" item
        await page.locator('[data-testid="header-plus"]').first().click({ timeout: 5000 });
        await page.getByText(/^Neues Projekt$|^New project$/).first().click({ timeout: 5000 });
      }
      const nameInput = page.locator('[data-testid="project-name-input"]');
      await nameInput.waitFor({ timeout: 8000 });
      await nameInput.fill('Mein Dark-Test Projekt');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/p11-createmodal-dark-${vp.name}.png` });
      const inputColors = await nameInput.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color };
      });
      results.push({ shot: `createmodal-${vp.name}`, inputColors });
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {
      results.push({ shot: `createmodal-${vp.name}`, error: e.message });
    }

    // 3) Settings (deep-link)
    try {
      await page.goto(`${BASE}/dashboard?settings=connectors`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/p11-settings-dark-${vp.name}.png` });
      results.push({ shot: `settings-${vp.name}`, ...(await bodyBg(page)) });
    } catch (e) {
      results.push({ shot: `settings-${vp.name}`, error: e.message });
    }

    await ctx.close();
  }
  console.log(JSON.stringify(results, null, 1));
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
