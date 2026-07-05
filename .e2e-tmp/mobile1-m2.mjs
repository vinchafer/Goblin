// MOBILE-1 · M2 gate harness. Seeds a project base file + a session draft that
// DIFFERS (→ GEÄNDERT card) plus a saved unchanged file (→ Reader). Drives:
// card list → tap GEÄNDERT → Diff sheet; whole-file → Reader; filter highlight.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');
const envText = readFileSync(path.join(repo, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_ACCOUNT_EMAIL || 'vinc.hafner3@gmail.com';
const BASE = 'http://localhost:3100', API = 'http://localhost:3001';
const OUT = path.join(repo, '_sprint/mobile-1/shots');
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
async function req(page, m, url, opts) { const r = await page.request[m](url, opts); if (!r.ok()) throw new Error(`${m} ${url} -> ${r.status()} ${await r.text()}`); return r; }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => { const t = m.text(); if (t.includes('[M2')) console.log('CONSOLE:', t); });

async function token() {
  const g = await req(page, 'post', `${SUPA}/auth/v1/admin/generate_link`, { headers: H, data: { type: 'magiclink', email: EMAIL } });
  const otp = (await g.json()).email_otp;
  const v = await req(page, 'post', `${SUPA}/auth/v1/verify`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { type: 'magiclink', email: EMAIL, token: otp } });
  return (await v.json());
}

const s = await token();
await page.goto(`${BASE}/auth/test-callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}`);
await page.waitForURL(/\/dashboard/, { timeout: 40000 });

const u = await req(page, 'get', `${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: H });
const uid = (await u.json())[0].id;
const projectId = crypto.randomUUID();
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[MOBILE-1 M2] demo', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });

const auth = { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };

// 1. project BASE file (saved) — the diff/badge base.
const base = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Meine Seite</title></head>
<body>
  <h1>Willkommen</h1>
  <button id="cta">Los geht's</button>
</body></html>`;
await req(page, 'post', `${API}/api/projects/${projectId}/files`, { headers: auth, data: { path: 'index.html', content: base } });

// 2. code session with a DRAFT index.html that differs from the base → GEÄNDERT.
const draft = base.replace('<button id="cta">Los geht\'s</button>', '<button id="cta" class="big green">Los geht\'s</button>\n  <p>Neu hinzugefügt.</p>');
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M2] demo', initialContent: draft, initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
// 3. a second, SAVED (unchanged) file in the session → Reader path.
await req(page, 'patch', `${API}/api/code-sessions/${sessionId}/files`, { headers: auth, data: { path: 'style.css', content: 'body{font-family:system-ui;margin:2rem}\n.big{font-size:1.4rem}\n.green{color:#1A3A2A}\n', changeState: 'saved' } });

// Let the per-minute API rate-limit window (tripped by the seeding burst) reset
// before the browser fetches file contents for the diff base — otherwise the
// content GETs 429 and a changed file mislabels as NEU (test artifact only).
console.log('[M2] waiting 65s for rate-limit reset before navigate…');
await page.waitForTimeout(65000);

await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
// The GEÄNDERT badge depends on the diff base map (project-files fetch), which
// lands a beat after first render — wait for it before asserting/screenshotting.
await page.waitForSelector('[data-testid="badge-geaendert"]', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'm2-cards.png') });

const result = { ok: true, projectId, sessionId };
result.cardCount = await page.locator('[data-testid="file-card"]').count();
result.geaendertBadge = await page.locator('[data-testid="badge-geaendert"]').count();
// first card should be the GEÄNDERT one (floated up)
const firstStatus = await page.locator('[data-testid="file-card"]').first().getAttribute('data-status').catch(() => null);
result.firstCardStatus = firstStatus;

result.badges = await page.locator('[data-testid="file-card"]').evaluateAll(els => els.map(e => ({ status: e.getAttribute('data-status'), text: e.textContent?.trim().slice(0, 40) })));
// tap the GEÄNDERT card → Diff sheet first
const changed = page.locator('[data-testid="file-card"][data-status="changed"]').first();
if (await changed.count()) {
  await changed.click();
  await page.waitForSelector('[data-testid="diff-sheet"]', { timeout: 8000 }).catch(() => {});
  result.diffSheetOpened = await page.locator('[data-testid="diff-sheet"]').count() > 0;
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'm2-diff-sheet.png') });
  await page.locator('[data-testid="diff-sheet-wholefile"]').click().catch(() => {});
} else {
  result.diffSheetOpened = false;
  // fall back: open the first card's reader directly
  await page.locator('[data-testid="file-card"]').first().click().catch(() => {});
}
await page.waitForSelector('[data-testid="reader-code"]', { timeout: 8000 }).catch(() => {});
result.readerOpened = await page.locator('[data-testid="reader-code"]').count() > 0;
// no keyboard grab: the active element must NOT be a text input on reader open
result.activeTagOnReaderOpen = await page.evaluate(() => document.activeElement?.tagName ?? null);
await page.waitForTimeout(500);
// filter highlight
await page.locator('[data-testid="reader-filter"]').fill('button');
await page.waitForTimeout(500);
result.filterMatches = await page.locator('.gb-reader-match').count();
await page.screenshot({ path: path.join(OUT, 'm2-reader.png') });

console.log(JSON.stringify(result, null, 2));
await browser.close();
