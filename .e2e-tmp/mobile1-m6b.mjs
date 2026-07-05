// MOBILE-1 · M6 gate (lean): one dark-mode verify (clean code shot + attr) + the
// JIT publish→dismiss→persist cycle. Minimal sessions; paced to dodge rate limits.
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
async function login(page) {
  const g = await req(page, 'post', `${SUPA}/auth/v1/admin/generate_link`, { headers: H, data: { type: 'magiclink', email: EMAIL } });
  const otp = (await g.json()).email_otp;
  const v = await req(page, 'post', `${SUPA}/auth/v1/verify`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { type: 'magiclink', email: EMAIL, token: otp } });
  const s = await v.json();
  await page.goto(`${BASE}/auth/test-callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}`);
  await page.waitForURL(/\/dashboard/, { timeout: 40000 });
  return s;
}
const result = { ok: true };
const browser = await chromium.launch();

// One JIT project reused for dark verify too (single session → one create).
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
const page = await ctx.newPage();
const s = await login(page);
const auth = { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
const u = await req(page, 'get', `${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: H });
const uid = (await u.json())[0].id;
const projectId = crypto.randomUUID();
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[M6b] demo', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M6b] demo', initialContent: '<!doctype html>\n<html lang="de">\n<head><title>M6</title></head>\n<body>\n  <h1>Dark + JIT</h1>\n  <p>Zeile.</p>\n</body>\n</html>', initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth });

const url = `${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`;
await page.goto(url);
await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(3000);
// Dark verify: open the reader so real code shows dark, then screenshot.
result.darkTheme = await page.getAttribute('.gb-codetab', 'data-editor-theme').catch(() => null);
await page.locator('[data-testid="file-card"]').first().click().catch(() => {});
await page.waitForSelector('[data-testid="reader-code"]', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'm6-dark-code-mobile.png') });
await page.locator('[data-testid="reader-close"]').click().catch(() => {});
await page.waitForTimeout(500);

// JIT: none before publish
result.jitBeforePublish = await page.locator('[data-testid="jit-card"]').count();
await page.locator('[data-testid="live-stellen"]').click().catch(() => {});
await page.locator('[data-testid="live-stellen-confirm"]').click().catch(() => {});
await page.locator('[data-testid="publish-stream"] button').waitFor({ timeout: 90000 }).catch(() => {});
await page.locator('[data-testid="publish-stream"] button').click().catch(() => {});
await page.waitForTimeout(1500);
result.jitAfterPublish = await page.locator('[data-testid="jit-card"]').count();
result.jitKind = await page.locator('[data-testid="jit-card"]').getAttribute('data-kind').catch(() => null);
await page.screenshot({ path: path.join(OUT, 'm6-jit-card.png') });
await page.locator('[data-testid="jit-later"]').click().catch(() => {});
await page.waitForTimeout(500);
result.jitAfterDismiss = await page.locator('[data-testid="jit-card"]').count();
await page.goto(url);
await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);
result.jitAfterReload = await page.locator('[data-testid="jit-card"]').count();

console.log(JSON.stringify(result, null, 2));
await browser.close();
