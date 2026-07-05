// Retry the W10 deploy on the existing session (already has the 4 generated files).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');
const env = {}; for (const l of readFileSync(path.join(repo, 'apps/web/.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = 'vinc.hafner3@gmail.com', BASE = 'http://localhost:3100';
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
const OUT = path.join(repo, '_sprint/mobile-1/shots');
const projectId = process.argv[2], sessionId = process.argv[3];
async function req(page, m, url, opts) { const r = await page.request[m](url, opts); if (!r.ok()) throw new Error(`${m} ${url} -> ${r.status()} ${await r.text()}`); return r; }
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const g = await req(page, 'post', `${SUPA}/auth/v1/admin/generate_link`, { headers: H, data: { type: 'magiclink', email: EMAIL } });
const otp = (await g.json()).email_otp;
const v = await req(page, 'post', `${SUPA}/auth/v1/verify`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { type: 'magiclink', email: EMAIL, token: otp } });
const s = await v.json();
await page.goto(`${BASE}/auth/test-callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}`);
await page.waitForURL(/\/dashboard/, { timeout: 40000 });
await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForSelector('[data-testid="live-stellen"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(2000);
const result = { ok: true };
await page.locator('[data-testid="live-stellen"]').click().catch(() => {});
await page.locator('[data-testid="live-stellen-confirm"]').click().catch(() => {});
await page.locator('[data-testid="publish-stream"] button').waitFor({ timeout: 150000 }).catch(() => {});
await page.waitForTimeout(1500);
const finalStream = (await page.locator('[data-testid="publish-stream"]').textContent().catch(() => '')) || '';
result.finalStream = finalStream.trim();
result.reachedLive = /Live gestellt|Published/i.test(finalStream);
try {
  const pr = await page.request.get(`${SUPA}/rest/v1/projects?id=eq.${projectId}&select=preview_url,last_deployed_at`, { headers: H });
  const pj = (await pr.json())[0] || {};
  result.previewUrl = pj.preview_url ?? null;
} catch {}
if (result.reachedLive) { await page.locator('[data-testid="publish-stream"] button').click().catch(() => {}); await page.waitForTimeout(800); }
await page.screenshot({ path: path.join(OUT, 'w10-live.png') });
console.log(JSON.stringify(result, null, 2));
await browser.close();
