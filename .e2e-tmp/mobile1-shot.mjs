// MOBILE-1 screenshot harness (local stack). Reuses the /auth/test-callback
// recipe. Usage: node .e2e-tmp/mobile1-shot.mjs <label> [seedContent]
// Env from apps/web/.env.local + overrides below.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

// Load apps/web/.env.local
const envText = readFileSync(path.join(repo, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_ACCOUNT_EMAIL || 'vinc.hafner3@gmail.com';
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const OUT = path.join(repo, '_sprint/mobile-1/shots');

const label = process.argv[2] || 'shot';
const seed = process.argv[3];

const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function req(page, method, url, opts) {
  const r = await page.request[method](url, opts);
  if (!r.ok()) throw new Error(`${method} ${url} -> ${r.status()} ${await r.text()}`);
  return r;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

// 1. login
const gen = await req(page, 'post', `${SUPA}/auth/v1/admin/generate_link`, { headers: H, data: { type: 'magiclink', email: EMAIL } });
const gj = await gen.json();
const otp = gj.email_otp || gj.properties?.email_otp;
const ver = await req(page, 'post', `${SUPA}/auth/v1/verify`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { type: 'magiclink', email: EMAIL, token: otp } });
const vj = await ver.json();
await page.goto(`${BASE}/auth/test-callback#access_token=${vj.access_token}&refresh_token=${vj.refresh_token}`);
await page.waitForURL(/\/dashboard/, { timeout: 40000 });

// 2. resolve user + project
const u = await req(page, 'get', `${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: H });
const uid = (await u.json())[0].id;
let pr = await req(page, 'get', `${SUPA}/rest/v1/projects?user_id=eq.${uid}&select=id&order=created_at.desc&limit=1`, { headers: H });
let rows = await pr.json();
let projectId = rows[0]?.id;
if (!projectId) {
  projectId = crypto.randomUUID();
  await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[MOBILE-1] demo', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });
}

// 3. mint user token, create a code session w/ a seeded draft file
const g2 = await req(page, 'post', `${SUPA}/auth/v1/admin/generate_link`, { headers: H, data: { type: 'magiclink', email: EMAIL } });
const otp2 = (await g2.json()).email_otp;
const v2 = await req(page, 'post', `${SUPA}/auth/v1/verify`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { type: 'magiclink', email: EMAIL, token: otp2 } });
const token = (await v2.json()).access_token;

const content = seed || `<!doctype html>
<html lang="de">
  <head><meta charset="utf-8"><title>Meine Seite</title></head>
  <body>
    <h1>Willkommen</h1>
    <button id="cta">Los geht's</button>
    <script>document.getElementById('cta').onclick = () => alert('hi');</script>
  </body>
</html>`;
const cs = await req(page, 'post', `${API}/api/code-sessions`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  data: { projectId, name: '[MOBILE-1] demo', initialContent: content, initialFilename: 'index.html' },
});
const sessionId = (await cs.json()).session.id;

// 4. navigate to code surface
await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code`);
await page.waitForSelector('[data-testid="command-bar-input"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);

await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: false });

// 5. focus test — capture the top command bar's box before/after focusing the input
const topBefore = await page.locator('[data-testid="status-strip"]').boundingBox().catch(() => null);
await page.locator('[data-testid="command-bar-input"]').click().catch(() => {});
await page.waitForTimeout(600);
const topAfter = await page.locator('[data-testid="status-strip"]').boundingBox().catch(() => null);
await page.screenshot({ path: path.join(OUT, `${label}-focused.png`), fullPage: false });

console.log(JSON.stringify({
  ok: true, label, projectId, sessionId,
  commandBarPresent: await page.locator('[data-testid="command-bar-input"]').count() > 0,
  micPresent: await page.locator('[data-testid="command-bar-mic"]').count() > 0,
  statusStripPresent: await page.locator('[data-testid="status-strip"]').count() > 0,
  topBefore, topAfter,
  layoutJump: topBefore && topAfter ? Math.abs(topBefore.y - topAfter.y) : null,
}, null, 2));

await browser.close();
