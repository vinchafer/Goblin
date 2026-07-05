// MOBILE-1 desktop regression (1440px): the editor stays the front door; the
// mobile chrome (top command bar, file cards, status strip) does NOT leak.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');
const env = {}; for (const l of readFileSync(path.join(repo, 'apps/web/.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = 'vinc.hafner3@gmail.com', BASE = 'http://localhost:3100', API = 'http://localhost:3001';
const OUT = path.join(repo, '_sprint/mobile-1/shots');
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
async function req(page, m, url, opts) { const r = await page.request[m](url, opts); if (!r.ok()) throw new Error(`${m} ${url} -> ${r.status()} ${await r.text()}`); return r; }
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const g = await req(page, 'post', `${SUPA}/auth/v1/admin/generate_link`, { headers: H, data: { type: 'magiclink', email: EMAIL } });
const otp = (await g.json()).email_otp;
const v = await req(page, 'post', `${SUPA}/auth/v1/verify`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { type: 'magiclink', email: EMAIL, token: otp } });
const s = await v.json();
const auth = { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
await page.goto(`${BASE}/auth/test-callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}`);
await page.waitForURL(/\/dashboard/, { timeout: 40000 });
const u = await req(page, 'get', `${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: H });
const uid = (await u.json())[0].id;
const projectId = crypto.randomUUID();
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[desk] regress', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[desk]', initialContent: '<!doctype html>\n<html><body><h1>Desktop</h1>\n<p>Zwei.</p></body></html>', initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth });
await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForTimeout(9000);
const result = { ok: true };
// mobile-only chrome must be display:none / absent at desktop width
const vis = async (sel) => { const el = page.locator(sel).first(); if (!await el.count()) return false; return await el.isVisible().catch(() => false); };
result.commandBarVisible = await vis('[data-testid="command-bar-input"]');   // expect false
result.fileCardListVisible = await vis('[data-testid="file-card-list"]');     // expect false
result.statusStripVisible = await vis('[data-testid="status-strip"]');        // expect false
result.editorVisible = await page.locator('.cm-content').first().isVisible().catch(() => false); // expect true (front door)
result.threadComposerVisible = await page.locator('textarea').first().isVisible().catch(() => false); // desktop thread composer
await page.screenshot({ path: path.join(OUT, 'desktop-regression.png') });
console.log(JSON.stringify(result, null, 2));
await browser.close();
