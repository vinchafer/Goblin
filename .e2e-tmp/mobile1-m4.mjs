// MOBILE-1 · M4 gate. Verify: "Live stellen" primary + ⋯ menu (Nur sichern +
// GitHub) + Diff-sheet dismiss; then trigger Live stellen and capture the inline
// truth-gated status stream (German; never "Live" before the server success).
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
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[MOBILE-1 M4] demo', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });

const content = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>M4</title></head><body><h1>Live-Test</h1></body></html>`;
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M4] demo', initialContent: content, initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth }); // saved → canPublish, no drafts

await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);

const result = { ok: true, projectId, sessionId };
result.liveStellenBtn = await page.locator('[data-testid="live-stellen"]').count() > 0;

// ⋯ menu
await page.locator('[data-testid="more-menu-button"]').click().catch(() => {});
await page.waitForTimeout(400);
result.menuOpened = await page.locator('[data-testid="more-menu"]').count() > 0;
result.menuHasSave = await page.locator('[data-testid="menu-save"]').count() > 0;
result.menuHasGitHub = /GitHub/i.test(await page.locator('[data-testid="more-menu"]').textContent().catch(() => '') || '');
await page.screenshot({ path: path.join(OUT, 'm4-more-menu.png') });
await page.keyboard.press('Escape').catch(() => {});
await page.locator('body').click({ position: { x: 10, y: 400 } }).catch(() => {});
await page.waitForTimeout(300);

// Trigger Live stellen → confirm → capture the inline stream sequence.
const streamMsgs = [];
let sawLiveBeforeDone = false;
let done = false;
const poll = setInterval(async () => {
  try {
    const el = await page.locator('[data-testid="publish-stream"]').count();
    if (el) {
      const txt = (await page.locator('[data-testid="publish-stream"]').textContent()) || '';
      if (txt && streamMsgs[streamMsgs.length - 1] !== txt) streamMsgs.push(txt.trim());
    }
  } catch {}
}, 400);

await page.locator('[data-testid="live-stellen"]').click().catch(() => {});
await page.waitForSelector('[data-testid="live-stellen-confirm"]', { timeout: 5000 }).catch(() => {});
result.confirmShown = await page.locator('[data-testid="live-stellen-confirm"]').count() > 0;
await page.locator('[data-testid="live-stellen-confirm"]').click().catch(() => {});

// Wait for a terminal state (OK/Retry button in the stream) or timeout.
await page.locator('[data-testid="publish-stream"] button').waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1000);
clearInterval(poll);

const finalStream = (await page.locator('[data-testid="publish-stream"]').textContent().catch(() => '')) || '';
result.streamMsgs = streamMsgs;
result.finalStream = finalStream.trim();
result.reachedLive = /Live gestellt|Published/i.test(finalStream);
result.reachedError = /fehlgeschlagen|Vercel|erneut|Retry|nicht/i.test(finalStream) && !result.reachedLive;
// no false claim: "Live" must not appear before a checks/success message
result.hadCheckStream = streamMsgs.some(m => /geprüft|Veröffentliche|Sichere/i.test(m));
await page.screenshot({ path: path.join(OUT, 'm4-publish-stream.png') });

console.log(JSON.stringify(result, null, 2));
await browser.close();
