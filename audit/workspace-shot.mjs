// Phase-7 proof: capture the project workspace screens (chat/code/preview) that
// already exist, at desktop + mobile, to verify they match Screen 03's bar.
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'sprint-5', 'screens'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';
const PID = process.argv[2] || '5b8c6fe5-390a-4216-bcfb-8cfb105ace32';
const env = k => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
async function auth(page) {
  const r = await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { email: EMAIL, password: PW } });
  const d = await r.json();
  await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=${d.expires_in||3600}&token_type=bearer&type=magiclink`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(1200);
}
async function tab(page, name) {
  // tabs render in header: Chat / Code / Preview
  await page.locator(`text="${name}"`).first().click({ timeout: 5000 }).catch(()=>{});
  await page.waitForTimeout(1200);
}
(async () => {
  const b = await chromium.launch({ headless: true });
  for (const [vp, tag] of [[{ width: 1280, height: 860 }, 'desktop'], [{ width: 390, height: 844, deviceScaleFactor: 2 }, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const page = await ctx.newPage();
    await auth(page);
    await page.goto(`${BASE}/dashboard/project/${PID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `05-chat-${tag}.png`) });   // active chat
    await tab(page, 'Code');
    await page.screenshot({ path: path.join(OUT, `08-code-${tag}.png`) });
    await tab(page, 'Preview');
    await page.screenshot({ path: path.join(OUT, `09-preview-${tag}.png`) });
    await ctx.close();
  }
  console.log('WORKSPACE_DONE');
  await b.close();
})().catch(e => console.log('WORKSPACE_FATAL ' + e.message));
