// P1.3 evidence @375: the live-URL card in both states.
//  B (no drafts):   "Live · aktuell",  Öffnen = green primary.
//  A (drafts pend): "Live · älterer Stand — …",  Öffnen = neutral secondary.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const PROJECT = '9c20b58f-e76b-4bce-93ea-a400069bd265';

const browser = await chromium.launch();
const out = {};
try {
  const { page } = await loginContext(browser, { width: 375, height: 812, theme: 'light' });
  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard/project/${PROJECT}/work?tab=code`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.locator('[data-testid="command-bar-input"]').waitFor({ timeout: 90000 });

  const card = page.locator('[data-testid="live-url-card"]');
  await card.waitFor({ timeout: 30000 });
  const read = async () => ({
    stale: await card.getAttribute('data-stale'),
    label: await page.locator('[data-testid="live-state-label"]').innerText().catch(() => null),
    oeffnenBg: await page.locator('[data-testid="live-oeffnen"]').evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => null),
  });

  // State A — drafts pending on load (hydrated changes vs the deployed base).
  await page.waitForTimeout(1000);
  out.stateA = await read();
  await page.screenshot({ path: `${OUT}/p13-stateA-stale-375.png` });

  // State B — publish the pending drafts to the saved base via ⋯ → "Nur sichern",
  // which drops draftCount to 0 → the card flips to "Live · aktuell" / green Öffnen.
  await page.locator('[data-testid="more-menu-button"]').click();
  await page.locator('[data-testid="menu-save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="live-url-card"]')?.getAttribute('data-stale') === '0', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  out.stateB = await read();
  await page.screenshot({ path: `${OUT}/p13-stateB-current-375.png` });

  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
