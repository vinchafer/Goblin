// WS-C prod walk — authenticated journey as vinc.hafner3 (sanctioned test account,
// magic-link via service role; NEVER a credential/OAuth login). Captures screenshots
// + console/page errors across the whole app at mobile 390 and desktop 1280.
// Run: node sprint-codetab/run-bigfix/walk.mjs [round]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROUND = process.argv[2] || 'r1';
const BASE = process.env.WALK_BASE || 'https://www.justgoblin.com';
const OUT = path.join(ROOT, 'sprint-codetab', 'run-bigfix', 'shots', ROUND);
fs.mkdirSync(OUT, { recursive: true });

function env(key) {
  try { const t = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8'); const m = t.match(new RegExp('^' + key + '=(.*)$', 'm')); return m ? m[1].trim() : ''; }
  catch { return ''; }
}
const EMAIL = env('TEST_ACCOUNT_EMAIL');
const PASSWORD = env('TEST_ACCOUNT_PASSWORD');
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL');
const SRK = env('SUPABASE_SERVICE_ROLE_KEY');
const ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const log = {};
const out = { base: BASE, round: ROUND, startedAt: new Date().toISOString(), email: EMAIL, surfaces: {} };
const save = () => fs.writeFileSync(path.join(OUT, '_out.json'), JSON.stringify(out, null, 2));

function attach(page, key) {
  log[key] = log[key] || [];
  page.on('console', m => { if (m.type() === 'error') log[key].push('CONSOLE: ' + m.text().slice(0, 240)); });
  page.on('pageerror', e => log[key].push('PAGEERROR: ' + (e.message || '').slice(0, 240)));
  page.on('requestfailed', r => { const f = r.failure(); if (f && !/favicon|_next\/static|sentry|analytics/.test(r.url())) log[key].push('REQFAIL: ' + r.url().slice(0, 120) + ' ' + f.errorText); });
}

async function describe(page) {
  try {
    return await page.evaluate(() => {
      const clip = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
      return {
        title: document.title, url: location.href,
        h: [...document.querySelectorAll('h1,h2,h3')].map(h => clip(h.innerText, 60)).filter(Boolean).slice(0, 12),
        text: clip(document.body?.innerText, 1500),
        emptyIconBtns: [...document.querySelectorAll('button')].filter(b => !b.innerText.trim() && !b.getAttribute('aria-label')).length,
        mixedLang: /\b(Settings|Save|Cancel|Delete|Loading|Account|Sign out|Logout|Back)\b/.test(document.body?.innerText || '') ? 'maybe-EN' : 'ok',
      };
    });
  } catch (e) { return { error: e.message }; }
}

async function visit(page, key, url, journey) {
  attach(page, key);
  let status = null, err = null;
  try { const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 }); status = r?.status(); }
  catch (e) { err = e.message; }
  await page.waitForTimeout(1300);
  let shot = null;
  try { shot = path.join(OUT, key + '.png'); await page.screenshot({ path: shot, fullPage: false }); shot = path.relative(ROOT, shot); }
  catch (e) { shot = 'ERR:' + e.message; }
  out.surfaces[key] = { url, finalUrl: page.url(), status, err, errors: (log[key] || []).slice(0, 12), desc: await describe(page) };
  save();
  return out.surfaces[key];
}

async function login(context, base) {
  const page = await context.newPage();
  attach(page, 'login');
  // Password grant → tokens → hand them to /auth/magic-callback via hash (the same
  // entrypoint the magic-link flow uses). Avoids the one-time-link otp_expired race.
  const res = await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, {
    headers: { 'Content-Type': 'application/json', apikey: ANON || SRK },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) { out.loginError = `pw ${res.status()}: ${(await res.text()).slice(0, 200)}`; save(); return null; }
  const t = await res.json();
  const hash = `#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=${t.expires_in || 3600}&token_type=bearer&type=magiclink`;
  await page.goto(`${base}/auth/magic-callback${hash}`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForURL(/\/dashboard/, { timeout: 30000 }); } catch {}
  out.loginUrl = page.url(); out.loggedIn = /\/dashboard/.test(page.url()); save();
  return out.loggedIn ? page : null;
}

const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { width: 1366, height: 900 };

// Authenticated surfaces to sweep (mobile unless tagged desktop).
const SURFACES = [
  ['dashboard', '/dashboard'],
  ['settings', '/dashboard/settings'],
  ['settings-appearance', '/dashboard/settings/appearance'],
  ['settings-keys', '/dashboard/settings/keys'],
  ['settings-routing', '/dashboard/settings/routing'],
  ['settings-integrations', '/dashboard/settings/integrations'],
  ['settings-notifications', '/dashboard/settings/notifications'],
  ['settings-hosted', '/dashboard/settings/hosted'],
  ['settings-local', '/dashboard/settings/local'],
  ['settings-billing', '/dashboard/settings/billing'],
  ['usage', '/dashboard/usage'],
  ['upgrade', '/dashboard/upgrade'],
  ['chat', '/dashboard/chat'],
  ['help', '/help'],
  ['about', '/about'],
  ['privacy', '/privacy'],
  ['imprint', '/imprint'],
  ['changelog', '/changelog'],
  ['models', '/models'],
  ['pricing', '/pricing'],
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: MOBILE, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await login(ctx, BASE);
  if (!page) { console.log('LOGIN FAILED', out.loginError || out.loginUrl); await browser.close(); return; }
  console.log('logged in:', out.loginUrl);

  for (const [key, url] of SURFACES) {
    const r = await visit(page, 'm-' + key, BASE + url, key);
    console.log('m-' + key, r.status, r.finalUrl.replace(BASE, ''), (r.errors || []).length ? 'ERR×' + r.errors.length : '');
    await page.waitForTimeout(2200); // human pacing — avoid cumulative rate-limit noise
  }

  // Find a project via the API (the dashboard cards load async) and walk its
  // workspace + code tab + files (mobile + desktop).
  let projectId = null;
  try {
    const tok = await page.evaluate(async () => {
      // Pull the access token Supabase stored for API calls.
      for (const k of Object.keys(localStorage)) {
        if (k.includes('auth-token')) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch {} }
      }
      return null;
    });
    if (tok) {
      const r = await page.request.get('https://goblinapi-production.up.railway.app/api/projects', { headers: { Authorization: `Bearer ${tok}` } });
      if (r.ok()) { const arr = await r.json(); projectId = Array.isArray(arr) && arr[0]?.id ? arr[0].id : null; }
    }
  } catch {}
  out.projectId = projectId; save();
  console.log('project:', projectId);

  if (projectId) {
    const proj = [
      ['proj-overview', `/dashboard/project/${projectId}`],
      ['proj-work-code', `/dashboard/project/${projectId}/work?tab=code`],
      ['proj-files', `/dashboard/project/${projectId}/files`],
    ];
    for (const [key, url] of proj) {
      const r = await visit(page, 'm-' + key, BASE + url, key);
      console.log('m-' + key, r.status, (r.errors || []).length ? 'ERR×' + r.errors.length : '');
    }
    // Desktop pass for the file explorer (WS-B columns) + code tab.
    const dctx = await browser.newContext({ viewport: DESKTOP });
    const dpage = await login(dctx, BASE);
    if (dpage) {
      for (const [key, url] of [['d-proj-files', `/dashboard/project/${projectId}/files`], ['d-proj-work-code', `/dashboard/project/${projectId}/work?tab=code`]]) {
        const r = await visit(dpage, key, BASE + url, key);
        console.log(key, r.status, (r.errors || []).length ? 'ERR×' + r.errors.length : '');
      }
    }
    await dctx.close();
  }

  out.finishedAt = new Date().toISOString();
  save();
  await browser.close();
  console.log('DONE →', OUT);
}
run().catch(e => { console.error('FATAL', e); process.exit(1); });
