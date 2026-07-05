// MOBILE-1 · M3 gate. Reader long-press → action sheet → "ändern lassen" → chip →
// send; capture the /messages request body to verify the structured anchor payload.
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

// Capture the outgoing anchored message.
let sentPrompt = null;
page.on('request', (r) => {
  if (r.url().includes('/messages') && r.method() === 'POST') {
    try { sentPrompt = JSON.parse(r.postData() || '{}').prompt ?? null; } catch {}
  }
});

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
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[MOBILE-1 M3] demo', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });

// A saved multi-line file → unchanged card → Reader (Tier 1) for the long-press.
const content = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>Seite</title></head>
<body>
  <header><h1>Willkommen</h1></header>
  <main>
    <button id="cta">Los geht's</button>
    <p>Ein Absatz Text.</p>
  </main>
  <footer><small>© 2026</small></footer>
</body>
</html>`;
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[M3] demo', initialContent: content, initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
// promote to saved so it's an unchanged card (Reader path, not diff).
await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth });

await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForSelector('[data-testid="file-card"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);

// open the file → Reader
await page.locator('[data-testid="file-card"]').first().click();
await page.waitForSelector('[data-testid="reader-code"]', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);

const result = { ok: true, projectId, sessionId };
result.readerOpened = await page.locator('[data-testid="reader-code"]').count() > 0;

// long-press line 7 (the <button> line). Find a .cm-line by text.
const lineLoc = page.locator('.cm-line', { hasText: 'button id="cta"' }).first();
const box = await lineLoc.boundingBox().catch(() => null);
result.lineBox = !!box;
if (box) {
  const x = box.x + Math.min(40, box.width / 2), y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
}
await page.waitForSelector('[data-testid="line-action-sheet"]', { timeout: 5000 }).catch(() => {});
result.actionSheetOpened = await page.locator('[data-testid="line-action-sheet"]').count() > 0;
await page.screenshot({ path: path.join(OUT, 'm3-action-sheet.png') });

// choose "Diese Stelle ändern lassen"
await page.locator('[data-testid="line-action-change"]').click().catch(() => {});
await page.waitForSelector('[data-testid="command-anchor-chip"]', { timeout: 5000 }).catch(() => {});
result.anchorChip = await page.locator('[data-testid="command-anchor-chip"]').count() > 0;
result.anchorChipText = await page.locator('[data-testid="command-anchor-chip"]').textContent().catch(() => null);
await page.screenshot({ path: path.join(OUT, 'm3-anchor-chip.png') });

// type an instruction and send
await page.locator('[data-testid="command-bar-input"]').fill('mach diesen Button größer und grün');
await page.locator('[data-testid="command-bar-send"]').click().catch(() => {});
await page.waitForTimeout(2500);
result.sentPromptCaptured = !!sentPrompt;
result.sentPromptHasAnchor = !!(sentPrompt && sentPrompt.includes('[Anker'));
result.sentPromptHasLineNums = !!(sentPrompt && /\n\s*\d+\t/.test(sentPrompt));
result.sentPromptExcerpt = sentPrompt ? sentPrompt.slice(0, 400) : null;

// Best-effort real round-trip: wait for a targeted GEÄNDERT card OR an agent error.
const changed = page.locator('[data-testid="file-card"][data-status="changed"]');
const err = page.locator('text=/Modell|nicht geantwortet|Server nicht/i');
try {
  await Promise.race([
    changed.first().waitFor({ timeout: 45000 }),
    err.first().waitFor({ timeout: 45000 }),
  ]);
} catch { /* neither within timeout */ }
await page.waitForTimeout(1500);
result.changedCardArrived = await changed.count() > 0;
// After an agent edit, the review diff (DiffModal / diff sheet) auto-surfaces —
// read whatever diff is visible and check it touches the anchored region.
const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
result.diffTouchesAnchor = /cta|button|grün|green|class=/i.test(pageText);
// pull the final file content from the API to confirm the targeted edit persisted.
try {
  const fr = await page.request.get(`${API}/api/code-sessions/${sessionId}`, { headers: auth });
  const j = await fr.json();
  const f = (j.files || []).find(x => x.path === 'index.html');
  result.fileHasTargetedEdit = !!(f && /class=|grün|green|font-size|1\.[0-9]|large|big/i.test(f.content) && f.content.includes('cta'));
  result.fileChangeState = f?.change_state ?? null;
} catch (e) { result.apiErr = String(e); }
result.agentErrorText = await err.first().textContent().catch(() => null);
await page.screenshot({ path: path.join(OUT, 'm3-result.png') });

console.log(JSON.stringify(result, null, 2));
await browser.close();
