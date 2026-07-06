// P1.11 evidence: a token-less "Live stellen" opens the connect JIT (no dead end);
// connecting inline resumes the publish. Vercel status/connect + the deploy SSE are
// stubbed so the full path runs without a real Vercel token.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const PROJECT = '9c20b58f-e76b-4bce-93ea-a400069bd265';

const browser = await chromium.launch();
const out = {};
try {
  const { ctx, page } = await loginContext(browser, { width: 1280, height: 900, theme: 'light' });

  let vercelConnected = false; // real state: this account has no Vercel token
  // Stub the Vercel integration status + connect.
  await ctx.route('**/api/integrations/vercel', async (route) => {
    const m = route.request().method();
    if (m === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: vercelConnected }) });
    } else if (m === 'POST') {
      vercelConnected = true; // connecting flips the state
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, account: { username: 'test-user' } }) });
    } else {
      await route.fallback();
    }
  });
  // Stub save (no-op ok) + the deploy SSE (success with a live url).
  await ctx.route('**/api/code-sessions/**/save', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, saved: [] }) }));
  await ctx.route('**/api/code-sessions/**/deploy', (route) =>
    route.fulfill({
      status: 200, contentType: 'text/event-stream',
      body: 'data: {"type":"progress","message":"Wird geprüft, 6/6"}\n\ndata: {"type":"success","url":"https://test-goblin.vercel.app"}\n\n',
    }));

  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard/project/${PROJECT}/work?tab=code`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.locator('[data-testid="live-stellen"]').waitFor({ timeout: 90000 });

  // Tap "Live stellen" → confirm → should open the JIT, NOT a raw error.
  await page.locator('[data-testid="live-stellen"]').click();
  await page.locator('[data-testid="live-stellen-confirm"]').click();
  const sheet = page.locator('[data-testid="vercel-jit-sheet"]');
  await sheet.waitFor({ timeout: 15000 });
  out.jitAppeared = await sheet.isVisible();
  out.jitCopy = await sheet.innerText().catch(() => null);
  await page.screenshot({ path: `${OUT}/p111-jit-sheet.png` });

  // Connect inline → resume the publish.
  await page.locator('[data-testid="vercel-jit-token"]').fill('vercel_test_token_123');
  await page.locator('[data-testid="vercel-jit-connect"]').click();
  // Sheet closes, publish resumes → publish stream + live url.
  // Resumed publish → the deploy ran (progress "geprüft") and a LIVE state shows.
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="vercel-jit-sheet"]') &&
          (document.querySelector('[data-testid="live-url-card"]') !== null ||
           /geprüft|Live gestellt|Live · /i.test(document.body.innerText || '')),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  out.sheetClosed = !(await sheet.isVisible().catch(() => false));
  const txt = await page.evaluate(() => document.body.innerText);
  out.publishResumed = (await page.locator('[data-testid="live-url-card"]').count()) > 0 || /geprüft|Live gestellt|Live · aktuell|vercel\.app/i.test(txt);
  await page.screenshot({ path: `${OUT}/p111-publish-resumed.png`, fullPage: true });

  console.log(JSON.stringify(out, null, 1));
  await ctx.close();
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
