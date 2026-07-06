// P1.2 evidence @375: (1) long text wraps in the command textarea,
// (2) send -> "Goblin arbeitet… <n>s" working state within 300ms,
// (3) result -> change pop-up "Goblin hat <n> Dateien geändert".
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const PROJECT = '9c20b58f-e76b-4bce-93ea-a400069bd265';
const LONG = 'Mach die Überschrift auf der Startseite deutlich größer und fett, '
  + 'ändere die Hintergrundfarbe zu einem warmen Beige, füge unten einen '
  + 'Call-to-Action-Button mit der Aufschrift Jetzt starten hinzu und sorge '
  + 'dafür, dass alles auf dem Handy gut aussieht.';

const browser = await chromium.launch();
const out = {};
try {
  const { page } = await loginContext(browser, { width: 375, height: 812, theme: 'light' });
  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard/project/${PROJECT}/work?tab=code`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  const input = page.locator('[data-testid="command-bar-input"]');
  await input.waitFor({ timeout: 90000 });
  await page.waitForTimeout(1200);

  // Phase 1: long text wraps -> textarea grows past a single line.
  const h1 = await input.evaluate((el) => el.getBoundingClientRect().height);
  await input.click();
  await input.fill(LONG);
  await page.waitForTimeout(300);
  const h2 = await input.evaluate((el) => el.getBoundingClientRect().height);
  await page.screenshot({ path: `${OUT}/p12-phase1-wrap-375.png` });
  out.phase1 = { heightBefore: Math.round(h1), heightAfter: Math.round(h2), grew: h2 > h1 + 8 };

  // Phase 2: send -> working state within 300ms.
  const t0 = Date.now();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(280);
  await page.screenshot({ path: `${OUT}/p12-phase2-working-375.png` });
  const workingVisible = await page.locator('[data-testid="status-strip-working"]').isVisible().catch(() => false);
  out.phase2 = { workingVisibleAt: `${Date.now() - t0}ms`, workingVisible };

  // Phase 3: result -> change pop-up. Wait for the banner (or streaming to end).
  const banner = page.locator('[data-testid="change-summary"]');
  await banner.waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/p12-phase3-change-375.png` });
  out.phase3 = {
    bannerVisible: await banner.isVisible().catch(() => false),
    bannerText: await banner.innerText().catch(() => null),
  };
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
