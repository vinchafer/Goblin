// B11 — axe-core a11y audit across 12 routes. CDP to running Chrome (9222).
// Auth via password grant -> magic-callback. Saves per-route violations + a summary.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'http://localhost:3000';
const OUT = path.join(ROOT, 'sprint-4', 'a11y');
fs.mkdirSync(OUT, { recursive: true });
const phase = process.argv[2] || 'before';

const env = (k) => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const ROUTES = [
  '/', '/login', '/register', '/dashboard', '/dashboard/chat', '/dashboard/code',
  '/dashboard/preview', '/dashboard/new', '/pricing', '/help', '/terms', '/imprint',
];

const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '_'));
const summary = { phase, startedAt: new Date().toISOString(), routes: {} };

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // auth
  const d = await (await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { email: EMAIL, password: PW } })).json();
  await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=${d.expires_in || 3600}&token_type=bearer&type=magiclink`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 }).catch(() => {});

  for (const route of ROUTES) {
    const s = slug(route);
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1400);
      const finalUrl = page.url();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'best-practice']).analyze();
      const viol = results.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help,
        nodes: v.nodes.map(n => ({ target: n.target, html: (n.html || '').slice(0, 160) })),
      }));
      fs.writeFileSync(path.join(OUT, `${phase}-${s}.json`), JSON.stringify({ route, finalUrl, violations: viol }, null, 2));
      const bySev = {};
      for (const v of viol) bySev[v.impact] = (bySev[v.impact] || 0) + 1;
      summary.routes[route] = { finalUrl, redirected: !finalUrl.includes(route) && route !== '/', total: viol.length, bySev, ids: viol.map(v => `${v.id}(${v.impact},${v.nodes.length})`) };
      console.log(`${route} -> ${viol.length} violations`, JSON.stringify(bySev));
    } catch (e) {
      summary.routes[route] = { error: e.message };
      console.log(`${route} ERROR ${e.message}`);
    }
  }
  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, `${phase}-summary.json`), JSON.stringify(summary, null, 2));
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  console.log('A11Y_DONE phase=' + phase);
})().catch(e => { console.log('A11Y_FATAL ' + e.message); process.exit(1); });
