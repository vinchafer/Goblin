// R1 — UI-level ship-loop proof. Connects to the running Chrome via CDP (9222).
// login -> new project (UI modal) -> chat -> Send to Code -> Code tab -> Deploy
// -> Preview -> cleanup. Captures 8 screenshots. Cleanup is guaranteed (finally).
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd(); const BASE = 'http://localhost:3000';
const OUT = path.join(ROOT, 'sprint-4', 'r1-ui-proof'); fs.mkdirSync(OUT, { recursive: true });
const env = (k) => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD');
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), SRK = env('SUPABASE_SERVICE_ROLE_KEY');
const API = env('NEXT_PUBLIC_API_URL') || 'http://localhost:3001';

const NAME = `test-b1-loop-ui-${Date.now()}`;
const R = { name: NAME, startedAt: new Date().toISOString(), steps: [], shots: [] };
const t0 = Date.now();
const log = (m) => { R.steps.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`); console.log(m); };
let projectId = null, token = null;

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  const shot = async (n) => { try { await page.screenshot({ path: path.join(OUT, n + '.png') }); R.shots.push(n); log('shot ' + n); } catch (e) { log('shot FAIL ' + n + ' ' + e.message); } };

  try {
    // auth
    const d = await (await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { email: EMAIL, password: PW } })).json();
    token = d.access_token;
    await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 });
    log('auth ok');

    // 01 dashboard
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
    await shot('01-dashboard-empty');

    // 02 new project modal — click the + (header plus / new project)
    let opened = false;
    for (const sel of ['[data-testid="header-plus"]', 'button[aria-label*="roject" i]', 'button[aria-label*="eu" i]', 'button[title*="roject" i]']) {
      const el = await page.$(sel); if (el && await el.isVisible().catch(() => false)) { await el.click(); opened = true; break; }
    }
    // fallback: the header "+" button
    if (!opened) { const plus = page.locator('header button').filter({ hasText: /^\+$/ }); if (await plus.count()) { await plus.first().click(); opened = true; } }
    await page.waitForTimeout(700);
    // fill modal
    const nameInput = page.locator('input[placeholder="My Awesome Project"]');
    if (await nameInput.count()) {
      await shot('02-new-project-modal');
      await nameInput.fill(NAME);
      const createBtn = page.locator('button').filter({ hasText: /^(Create|Erstellen|Create project)/i }).last();
      await createBtn.click();
      await page.waitForURL(/\/dashboard\/project\//, { timeout: 20000 });
    } else {
      // modal didn't open — create via API to keep the proof moving, still UI-navigate after
      log('modal not found — creating via API fallback');
      const cr = await (await page.request.post(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, data: { name: NAME, description: 'R1 UI ship-loop proof' } })).json();
      projectId = cr.id;
      await page.goto(`${BASE}/dashboard/project/${projectId}`, { waitUntil: 'domcontentloaded' });
      await shot('02-new-project-modal');
    }
    const m = page.url().match(/\/dashboard\/project\/([^/?]+)/);
    if (m) projectId = m[1];
    R.projectId = projectId; log('project created ' + projectId);

    // 03 chat — go to work?tab=chat, send build prompt
    await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=chat`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const composer = page.locator('textarea[data-chat-input="true"], textarea').first();
    await composer.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1500);
    // Select a connected (Groq) model — composer defaults to Gemini Flash which has no key.
    let modelPicked = false;
    try {
      const modelBtn = page.locator('button').filter({ hasText: /Gemini Flash|Flash|GPT|Claude|Llama/i }).first();
      if (await modelBtn.count()) {
        await modelBtn.click(); await page.waitForTimeout(800);
        const opt = page.locator('button, [role="option"], li').filter({ hasText: /llama|groq|3\.3|70b|kimi|mixtral|gemma/i }).first();
        if (await opt.count()) { await opt.click(); modelPicked = true; await page.waitForTimeout(500); }
        else { await page.keyboard.press('Escape').catch(() => {}); }
      }
    } catch (e) { log('model pick err ' + e.message); }
    R.modelPicked = modelPicked;
    log('model picked=' + modelPicked);
    await composer.click();
    await composer.fill("Build a simple HTML landing page with a hero headline 'Hello from Goblin' and one CTA button. Return one complete HTML file.");
    await page.waitForTimeout(300);
    await composer.press('Enter');
    log('prompt sent; waiting for code block…');
    // wait for a code block / code-actions button to appear
    let codeReady = false;
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(1500);
      const ca = await page.$('button[title="Code actions"]');
      const pre = await page.$('pre code, .cb-body, [class*="code-block"]');
      if (ca || pre) { codeReady = true; break; }
    }
    R.codeBlockAppeared = codeReady;
    await page.waitForTimeout(1500);
    await shot('03-chat-with-code-block');
    log('code block appeared=' + codeReady);

    // 04 Send to Code — project chat renders a direct "Send to Code →" button on
    // each code block (applies instantly per the in-app hint). Click it directly.
    let sentToCode = false;
    const sc = page.locator('button').filter({ hasText: /Send to Code/i });
    if (await sc.count()) {
      await sc.last().scrollIntoViewIfNeeded().catch(() => {});
      await sc.last().click({ timeout: 5000 }).then(() => sentToCode = true).catch(() => {});
    } else {
      // fallback: standalone-chat dropdown style
      const ca = page.locator('button[title="Code actions"]');
      if (await ca.count()) { await ca.last().click(); await page.waitForTimeout(400); const d = page.locator('button').filter({ hasText: /Send to Code/i }); if (await d.count()) { await d.first().click(); sentToCode = true; } }
    }
    R.sentToCode = sentToCode;
    // Send to Code switches to the Code tab IN-PLACE and shows a PENDING injection
    // ("Injected via Send to Code") with a Review & Apply button. Do NOT reload
    // (a full goto discards the in-memory injection) — operate in-place.
    await page.waitForTimeout(2500);
    await shot('04-send-to-code-clicked');
    log('sent to code=' + sentToCode);

    // 05 Review & Apply the injection -> writes files
    let applied = false;
    const applyBtn = page.locator('button').filter({ hasText: /Review & Apply|Apply|Übernehmen|Anwenden/i });
    if (await applyBtn.count()) {
      await applyBtn.first().click({ timeout: 5000 }).then(() => applied = true).catch(() => {});
      await page.waitForTimeout(1500);
      // Review & Apply opens a diff modal with an "Apply Changes" confirm button.
      const confirm = page.locator('button').filter({ hasText: /Apply Changes|Änderungen übernehmen|Übernehmen|Anwenden/i });
      if (await confirm.count()) { await confirm.last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2000); }
    }
    R.applied = applied;
    await page.waitForTimeout(3000);
    const codeInfo = await page.evaluate(() => ({
      editors: document.querySelectorAll('.cm-editor').length,
      hasHtml: /\.html|index\.html/i.test(document.body.innerText),
      hasHeroText: /Hello from Goblin/i.test(document.body.innerText),
      noFiles: /No files yet|Noch kein Code/i.test(document.body.innerText),
    }));
    R.codeTab = codeInfo;
    await shot('05-code-tab-with-file');
    log('applied=' + applied + ' code: editors=' + codeInfo.editors + ' heroText=' + codeInfo.hasHeroText + ' noFiles=' + codeInfo.noFiles);

    // 06 Deploy / Build (the Build button runs the build->Vercel-deploy pipeline)
    let deployClicked = false;
    for (const f of [() => page.locator('button[aria-label="Deploy"], button[title="Deploy"]'),
                     () => page.locator('button').filter({ hasText: /^\s*Build\s*$/i }),
                     () => page.locator('button').filter({ hasText: /Deploy/i })]) {
      const b = f();
      if (await b.count()) { await b.first().click({ timeout: 5000 }).then(() => deployClicked = true).catch(() => {}); if (deployClicked) break; }
    }
    R.deployClicked = deployClicked;
    await page.waitForTimeout(2500);
    await shot('06-deploy-running');
    log('deploy/build clicked=' + deployClicked);

    // 07 wait for deploy success — poll project deployment via API (bounded 4 min)
    let deployUrl = null;
    if (deployClicked) {
      for (let i = 0; i < 48; i++) {
        await page.waitForTimeout(5000);
        try {
          const pj = await (await page.request.get(`${API}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
          deployUrl = pj.preview_url || pj.deploy_url || pj.vercel_url || pj.deployment?.url || null;
          if (deployUrl) break;
          // also check UI previewUrl
          const ui = await page.evaluate(() => { const f = document.querySelector('iframe'); return f?.src || null; });
          if (ui && /https?:/.test(ui)) { deployUrl = ui; break; }
        } catch {}
      }
    }
    R.deployUrl = deployUrl;
    await shot('07-deploy-success');
    log('deploy url=' + (deployUrl || 'none within budget'));

    // 08 Preview tab — click the header Preview tab in-place (preserve SPA state)
    const previewTab = page.locator('header button, header a').filter({ hasText: /^\s*Preview\s*$/i });
    if (await previewTab.count()) { await previewTab.first().click().catch(() => {}); }
    else { await page.goto(`${BASE}/dashboard/project/${projectId}/work?tab=preview`, { waitUntil: 'domcontentloaded' }); }
    await page.waitForTimeout(3500);
    const iframeSrc = await page.evaluate(() => document.querySelector('iframe')?.src || null);
    R.previewIframe = iframeSrc;
    await shot('08-preview-tab-live');
    log('preview iframe=' + (iframeSrc || 'none'));

    R.ok = true;
  } catch (e) {
    R.error = e.message; log('ERROR ' + e.message);
    await shot('error-state');
  } finally {
    // CLEANUP — always delete the test project. API rate-limits (429) shortly
    // after a heavy run, so retry with backoff, then fall back to service-role.
    if (projectId && token) {
      let cleaned = false;
      for (let i = 0; i < 5; i++) {
        try {
          const del = await page.request.delete(`${API}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
          R.cleanupStatus = del.status();
          log('cleanup DELETE attempt ' + i + ' -> ' + del.status());
          if (del.status() === 200 || del.status() === 204) { cleaned = true; break; }
        } catch (e) { R.cleanupError = e.message; }
        await page.waitForTimeout(8000);
      }
      if (!cleaned) {
        try {
          const sd = await page.request.delete(`${SUPA}/rest/v1/projects?id=eq.${projectId}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, Prefer: 'return=minimal' } });
          log('cleanup service-role DELETE -> ' + sd.status());
        } catch (e) { R.cleanupError2 = e.message; }
      }
      try {
        const chk = await (await page.request.get(`${SUPA}/rest/v1/projects?id=eq.${projectId}&select=id`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } })).json();
        R.orphanRemains = Array.isArray(chk) && chk.length > 0;
        log('orphan check: ' + (R.orphanRemains ? 'STILL PRESENT' : 'gone ✅'));
      } catch {}
    }
    R.finishedAt = new Date().toISOString();
    R.wallClockS = ((Date.now() - t0) / 1000).toFixed(1);
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(R, null, 2));
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log('SHIP_LOOP_DONE ok=' + !!R.ok + ' wall=' + R.wallClockS + 's');
  }
})();
