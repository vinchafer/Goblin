// MOBILE-1 · M6 gate. (A) dark mode = prefers-color-scheme default (375px+desktop
// screenshots of code surface, dashboard, chat). (B) JIT GitHub card appears after
// the first successful publish, dismiss persists across reload.
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

// ── (A) Dark mode: OS prefers dark → editor surface is dark by default ──
for (const [label, w, h] of [['mobile', 375, 812], ['desktop', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', deviceScaleFactor: 1, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
  const page = await ctx.newPage();
  const s = await login(page);
  const auth = { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
  const u = await req(page, 'get', `${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: H });
  const uid = (await u.json())[0].id;
  const projectId = crypto.randomUUID();
  await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: `[M6 ${label}] dark`, user_id: uid, intent: 'web_app', color: '#1A3A2A' } });
  const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M6] dark', initialContent: '<!doctype html><html><body><h1>Dark</h1></body></html>', initialFilename: 'index.html' } });
  const sessionId = (await cs.json()).session.id;
  await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth });

  await page.screenshot({ path: path.join(OUT, `m6-dark-dashboard-${label}.png`) });
  await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
  await page.waitForTimeout(2500);
  result[`darkTheme_${label}`] = await page.getAttribute('.gb-codetab', 'data-editor-theme').catch(() => null);
  await page.screenshot({ path: path.join(OUT, `m6-dark-code-${label}.png`) });
  await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=chat`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, `m6-dark-chat-${label}.png`) });
  await ctx.close();
}

// ── (B) JIT card: appears after first publish; Später persists across reload ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const s = await login(page);
  const auth = { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
  const u = await req(page, 'get', `${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: H });
  const uid = (await u.json())[0].id;
  const projectId = crypto.randomUUID();
  await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[M6] jit', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });
  const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M6] jit', initialContent: '<!doctype html><html><body><h1>JIT</h1></body></html>', initialFilename: 'index.html' } });
  const sessionId = (await cs.json()).session.id;
  await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth });

  const url = `${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`;
  await page.goto(url);
  await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);
  result.jitBeforePublish = await page.locator('[data-testid="jit-card"]').count(); // expect 0

  // publish (real deploy) → first successful publish
  await page.locator('[data-testid="live-stellen"]').click().catch(() => {});
  await page.locator('[data-testid="live-stellen-confirm"]').click().catch(() => {});
  await page.locator('[data-testid="publish-stream"] button').waitFor({ timeout: 90000 }).catch(() => {});
  await page.locator('[data-testid="publish-stream"] button').click().catch(() => {}); // OK
  await page.waitForTimeout(1500);
  result.jitAfterPublish = await page.locator('[data-testid="jit-card"]').count();     // expect 1
  result.jitKind = await page.locator('[data-testid="jit-card"]').getAttribute('data-kind').catch(() => null);
  await page.screenshot({ path: path.join(OUT, 'm6-jit-card.png') });

  // dismiss "Später"
  await page.locator('[data-testid="jit-later"]').click().catch(() => {});
  await page.waitForTimeout(500);
  result.jitAfterDismiss = await page.locator('[data-testid="jit-card"]').count();     // expect 0

  // reload → dismiss persists
  await page.goto(url);
  await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);
  result.jitAfterReload = await page.locator('[data-testid="jit-card"]').count();       // expect 0
  await ctx.close();
}

console.log(JSON.stringify(result, null, 2));
await browser.close();
