// P1.9 evidence: connectors page explains itself (GitHub/Vercel what+steps+eta)
// and shows honest disabled "Bald" cards (Supabase/Stripe/Domain) that can't be
// clicked or tabbed into. DE + EN, 375 + desktop.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const COMBOS = [
  { lang: 'de', w: 375, h: 900, name: 'de-375' },
  { lang: 'en', w: 375, h: 900, name: 'en-375' },
  { lang: 'de', w: 1280, h: 900, name: 'de-desktop' },
  { lang: 'en', w: 1280, h: 900, name: 'en-desktop' },
];

const browser = await chromium.launch();
const out = {};
try {
  for (const c of COMBOS) {
    const { ctx, page } = await loginContext(browser, { width: c.w, height: c.h, theme: 'light', lang: c.lang });
    page.setDefaultNavigationTimeout(150000);
    await page.goto(`${BASE}/dashboard?settings=connectors`, { waitUntil: 'domcontentloaded', timeout: 150000 });
    await page.locator('[data-testid="connector-soon"]').first().waitFor({ timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/p19-connectors-${c.name}.png`, fullPage: true });

    // Disabled "Bald" cards must not be focusable/clickable: no tabbable
    // descendants, and the card itself is not a button/link/[tabindex].
    const audit = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="connector-soon"]'));
      const tabbableSel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
      return {
        count: cards.length,
        names: cards.map((c) => c.querySelector('span')?.parentElement?.textContent?.trim().slice(0, 24)),
        anyFocusable: cards.some((c) => c.matches(tabbableSel) || c.querySelector(tabbableSel) !== null),
        allAriaDisabled: cards.every((c) => c.getAttribute('aria-disabled') === 'true'),
      };
    });
    out[c.name] = audit;
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
