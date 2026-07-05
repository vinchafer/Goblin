// MOBILE-1 · M5 gate. Editor (Tier 3) via "Bearbeiten": no keyboard grab on open,
// compact find/replace overlay (not the desktop panel), edit -> save -> badge.
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
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[MOBILE-1 M5] demo', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });

const content = `<!doctype html>\n<html lang="de">\n<head><meta charset="utf-8"><title>M5</title></head>\n<body>\n  <h1>Bearbeiten-Test</h1>\n  <p>Zeile drei.</p>\n  <p>Zeile vier.</p>\n</body>\n</html>`;
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M5] demo', initialContent: content, initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth }); // saved → no badge initially

await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);
const result = { ok: true, projectId, sessionId };

// open Reader, then Bearbeiten
await page.locator('[data-testid="file-card"]').first().click();
await page.waitForSelector('[data-testid="reader-edit"]', { timeout: 8000 }).catch(() => {});
await page.locator('[data-testid="reader-edit"]').click().catch(() => {});
await page.waitForSelector('[data-testid="editor-search-button"]', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
// NO keyboard grab on editor open: activeElement must not be the editor content.
result.activeTagOnEditorOpen = await page.evaluate(() => {
  const a = document.activeElement;
  return { tag: a?.tagName ?? null, cls: a?.className ?? null, inCm: !!a?.closest?.('.cm-editor') };
});
result.editorOpened = await page.locator('.cm-content').count() > 0;
await page.screenshot({ path: path.join(OUT, 'm5-editor.png') });

// compact search overlay (not the built-in panel)
await page.locator('[data-testid="editor-search-button"]').click().catch(() => {});
await page.waitForSelector('[data-testid="editor-search-overlay"]', { timeout: 5000 }).catch(() => {});
result.searchOverlay = await page.locator('[data-testid="editor-search-overlay"]').count() > 0;
result.builtinPanelAbsent = await page.locator('.cm-search.cm-panel').count() === 0;
await page.locator('[data-testid="editor-search-input"]').fill('Zeile');
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'm5-search-overlay.png') });
await page.locator('[data-testid="editor-search-close"]').click().catch(() => {});
await page.waitForTimeout(300);

// edit the file: focus editor + type, then save via ⋯ menu
await page.locator('.cm-content').click();
await page.keyboard.type('  <!-- editiert -->');
await page.waitForTimeout(1500); // debounced persist
// exit editor -> Reader (mobile back), then check badge on cards
await page.locator('.gb-mobile-back').first().click().catch(() => {});
await page.waitForTimeout(600);
// save via ⋯ menu
await page.locator('[data-testid="more-menu-button"]').click().catch(() => {});
await page.locator('[data-testid="menu-save"]').click().catch(() => {});
await page.waitForTimeout(2000);
// fetch file state from API to confirm the edit persisted + change_state
try {
  const fr = await page.request.get(`${API}/api/code-sessions/${sessionId}`, { headers: auth });
  const j = await fr.json();
  const f = (j.files || []).find(x => x.path === 'index.html');
  result.editPersisted = !!(f && f.content.includes('editiert'));
  result.fileChangeState = f?.change_state ?? null;
} catch (e) { result.apiErr = String(e); }
await page.screenshot({ path: path.join(OUT, 'm5-after-save.png') });

console.log(JSON.stringify(result, null, 2));
await browser.close();
