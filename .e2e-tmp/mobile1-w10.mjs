// MOBILE-1 · W10 acceptance re-run. Fresh project, 375px, free-key model. Send the
// canonical compound message via the new command bar, then count EVERY user
// interaction (taps) to a deployed+verified result on the NEW surface. Baseline 7.
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

const MESSAGE = 'Füge eine Einstellungs-Seite mit Dark-Mode-Umschalter hinzu, speichere die Wahl in localStorage, bau das, und sag mir wenn es live ist.';

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
await req(page, 'post', `${SUPA}/rest/v1/projects`, { headers: { ...H, Prefer: 'return=minimal' }, data: { id: projectId, name: '[W10] island', user_id: uid, intent: 'web_app', color: '#1A3A2A' } });
// seed a starting index.html so there's a project to change (fresh project chat)
await req(page, 'post', `${API}/api/projects/${projectId}/files`, { headers: auth, data: { path: 'index.html', content: '<!doctype html>\n<html lang="de">\n<head><meta charset="utf-8"><title>Meine App</title></head>\n<body>\n  <h1>Meine App</h1>\n</body>\n</html>' } });
const cs = await req(page, 'post', `${API}/api/code-sessions`, { headers: auth, data: { projectId, name: '[W10] island', initialContent: '<!doctype html>\n<html lang="de">\n<head><meta charset="utf-8"><title>Meine App</title></head>\n<body>\n  <h1>Meine App</h1>\n</body>\n</html>', initialFilename: 'index.html' } });
const sessionId = (await cs.json()).session.id;
await req(page, 'post', `${API}/api/code-sessions/${sessionId}/save`, { headers: auth });

await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=code&session=${sessionId}`);
await page.waitForSelector('[data-testid="command-bar-input"]', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(2000);

const taps = [];
const tap = async (loc, label) => { await loc.click(); taps.push(label); };

// THE message (interaction 0 — NOT counted).
await page.locator('[data-testid="command-bar-input"]').fill(MESSAGE);
await page.locator('[data-testid="command-bar-send"]').click(); // the message send
await page.waitForTimeout(1000);

// Wait for the model to finish (streaming ends) — a review modal or new cards appear.
// Count each REVIEW acceptance as one wanted interaction (diff seen before publish).
const result = { ok: true, projectId, sessionId };
// wait for generation to settle
await page.waitForTimeout(3000);
for (let i = 0; i < 6; i++) {
  const applyBtn = page.locator('button:has-text("Übernehmen")').first();
  if (await applyBtn.count() && await applyBtn.isVisible().catch(() => false)) {
    await tap(applyBtn, `Übernehmen (Diff geprüft)`);
    await page.waitForTimeout(1500);
    continue;
  }
  // still streaming?
  const streaming = await page.locator('[data-testid="command-bar-input"]').isDisabled().catch(() => false);
  if (streaming) { await page.waitForTimeout(3000); continue; }
  break;
}
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, 'w10-after-generate.png') });
result.afterGenerateTaps = [...taps];

// Publish via the new surface: Live stellen → confirm.
if (await page.locator('[data-testid="live-stellen"]').count()) {
  await tap(page.locator('[data-testid="live-stellen"]'), 'Live stellen');
  await page.waitForSelector('[data-testid="live-stellen-confirm"]', { timeout: 5000 }).catch(() => {});
  if (await page.locator('[data-testid="live-stellen-confirm"]').count()) {
    await tap(page.locator('[data-testid="live-stellen-confirm"]'), 'Live stellen bestätigen');
  }
}
// wait for the truth-gated deploy to finish
await page.locator('[data-testid="publish-stream"] button', { hasText: /OK|Erneut|Retry/ }).waitFor({ timeout: 120000 }).catch(() => {});
await page.waitForTimeout(1500);

const finalStream = (await page.locator('[data-testid="publish-stream"]').textContent().catch(() => '')) || '';
result.reachedLive = /Live gestellt|Published/i.test(finalStream);
// confirm deployed URL persisted server-side
try {
  const pr = await page.request.get(`${SUPA}/rest/v1/projects?id=eq.${projectId}&select=preview_url,last_deployed_at`, { headers: H });
  const pj = (await pr.json())[0] || {};
  result.previewUrl = pj.preview_url ?? null;
  result.lastDeployedAt = pj.last_deployed_at ?? null;
} catch {}
await page.screenshot({ path: path.join(OUT, 'w10-live.png') });

result.taps = taps;
result.interactionCount = taps.length;
console.log(JSON.stringify(result, null, 2));
await browser.close();
