// Capture Connectors + Modelle settings sections (Phase 4/5 proof), desktop + mobile.
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const CON = path.join(ROOT, 'sprint-5', 'connectors'); const MOD = path.join(ROOT, 'sprint-5', 'modelle');
fs.mkdirSync(CON, { recursive: true }); fs.mkdirSync(MOD, { recursive: true });
const BASE = 'http://localhost:3000';
const env = k => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const log = {};
async function auth(page) {
  const r = await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { email: EMAIL, password: PW } });
  const d = await r.json();
  await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=${d.expires_in||3600}&token_type=bearer&type=magiclink`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(1500);
}
async function openSettings(page) {
  await page.click('[data-testid="header-avatar"]', { timeout: 8000 }).catch(()=>{});
  await page.waitForTimeout(400);
  await page.click('[data-testid="avatar-menu-settings"]', { timeout: 8000 }).catch(()=>{});
  await page.waitForTimeout(1000);
}
async function gotoSection(page, label) {
  // click the nav item with this label inside the settings UI
  const el = page.locator(`text="${label}"`).last();
  await el.click({ timeout: 6000 }).catch(()=>{});
  await page.waitForTimeout(900);
}
(async () => {
  const b = await chromium.launch({ headless: true });
  // Desktop
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await auth(page);
  await openSettings(page);
  log.desktopAfterOpen = page.url();
  await gotoSection(page, 'Konnektoren');
  await page.screenshot({ path: path.join(CON, 'desktop.png') });
  await gotoSection(page, 'Modelle');
  await page.screenshot({ path: path.join(MOD, 'desktop.png') });
  // Mobile
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await auth(mp);
  await openSettings(mp);
  await gotoSection(mp, 'Konnektoren');
  await mp.screenshot({ path: path.join(CON, 'mobile.png') });
  await gotoSection(mp, 'Modelle');
  await mp.screenshot({ path: path.join(MOD, 'mobile.png') });
  fs.writeFileSync(path.join(ROOT, 'sprint-5', 'settings-sections-shot.json'), JSON.stringify(log, null, 2));
  console.log('SECTIONS_DONE ' + JSON.stringify(log));
  await b.close();
})().catch(e => console.log('SECTIONS_FATAL ' + e.message));
