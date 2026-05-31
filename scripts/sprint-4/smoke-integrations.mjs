// R5 — Integrations visual smoke. Connects to the ALREADY-RUNNING Chrome via CDP (port 9222).
// Auth: password grant -> /auth/magic-callback (same pattern as audit/lean.mjs).
// Drives the real settings UI (ConnectorsPage) at desktop + mobile widths; screenshots both.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'http://localhost:3000';
const CDP = 'http://localhost:9222';
const OUT = path.join(ROOT, 'sprint-4', 'r5-integrations-smoke');
fs.mkdirSync(OUT, { recursive: true });

const env = (k) => {
  const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD');
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const R = { startedAt: new Date().toISOString(), steps: [] };
const log = (m) => { R.steps.push(`${new Date().toISOString().slice(11, 19)} ${m}`); console.log(m); };

async function openConnectors(page) {
  // open avatar menu -> Einstellungen
  await page.click('[data-testid="header-avatar"]', { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.click('[data-testid="avatar-menu-settings"]', { timeout: 8000 });
  await page.waitForTimeout(600);
  // click the Konnektoren nav row (works in both modal nav + mobile sheet root)
  const byTestId = page.locator('[data-testid="row-konnektoren"]');
  if (await byTestId.count() > 0) {
    await byTestId.first().click();
  } else {
    await page.getByText('Konnektoren', { exact: true }).first().click();
  }
  await page.waitForTimeout(900);
  // Wait for the Vercel connector's async status fetch to settle (Railway prod API latency).
  await page.waitForFunction(() => !/Lade…/.test(document.body.innerText), { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function connectorState(page) {
  return page.evaluate(() => {
    const txt = document.body.innerText;
    const hasVercel = /Vercel/.test(txt);
    const hasTrennen = /Trennen/.test(txt);
    const comingSoon = /Coming soon|Bald/.test(txt);
    // grab the Vercel row detail line if present
    return { hasVercel, hasTrennen, comingSoon, snippet: txt.slice(0, 1200) };
  });
}

(async () => {
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();
  try {
    // --- auth (password grant) ---
    const tokRes = await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      data: { email: EMAIL, password: PW },
    });
    R.pwStatus = tokRes.status();
    if (!tokRes.ok()) throw new Error('password grant failed: ' + tokRes.status() + ' ' + (await tokRes.text()));
    const d = await tokRes.json();
    log('auth: password grant 200');
    await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=${d.expires_in || 3600}&token_type=bearer&type=magiclink`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 });
    log('auth: landed ' + page.url());

    // --- DESKTOP 1280x860 ---
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await openConnectors(page);
    R.desktop = await connectorState(page);
    await page.screenshot({ path: path.join(OUT, 'desktop-1280.png') });
    log('desktop: shot saved; vercel=' + R.desktop.hasVercel + ' trennen=' + R.desktop.hasTrennen);

    // close modal (Esc) then go mobile
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    // --- MOBILE 390x844 ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await openConnectors(page);
    R.mobile = await connectorState(page);
    // horizontal scroll check
    R.mobile.horizScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    await page.screenshot({ path: path.join(OUT, 'mobile-390.png'), fullPage: true });
    log('mobile: shot saved; vercel=' + R.mobile.hasVercel + ' trennen=' + R.mobile.hasTrennen + ' horizScroll=' + R.mobile.horizScroll);

    R.ok = true;
  } catch (e) {
    R.error = e.message;
    log('ERROR ' + e.message);
    try { await page.screenshot({ path: path.join(OUT, 'error-state.png') }); } catch {}
  } finally {
    R.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(R, null, 2));
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log('SMOKE_DONE ok=' + !!R.ok);
  }
})();
