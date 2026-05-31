// Capture exact rendered contrast ratios for the tokens behind the remaining
// color-contrast violations, so the B11 report can recommend precise fixes.
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const BASE = 'http://localhost:3000';
const env = (k) => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = b.contexts()[0]; const page = await ctx.newPage();
  const d = await (await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { email: EMAIL, password: PW } })).json();
  await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/dashboard/, { timeout: 25000 }).catch(() => {});
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const lum = (rgb) => { const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
    const ratio = (f, bg) => { const L1 = lum(f), L2 = lum(bg); return ((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
    const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return m.slice(0, 3); };
    const cs = getComputedStyle(document.documentElement);
    const tok = (n) => cs.getPropertyValue(n).trim();
    const probe = [];
    const tryRatio = (label, el) => { if (!el) { probe.push({ label, note: 'not found' }); return; } let bg = 'rgb(255,255,255)', n = el; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } n = n.parentElement; } const fg = getComputedStyle(el).color; probe.push({ label, fg, bg, ratio: ratio(parse(fg), parse(bg)) }); };
    // ink-3 caption (timestamp)
    tryRatio('--ink-3 caption (timestamp)', [...document.querySelectorAll('span')].find(s => /\dd$|gerade|vor /.test(s.textContent || '') && getComputedStyle(s).color.includes('rgb')));
    return { tokens: { 'ink-3': tok('--ink-3'), 'text-faint': tok('--text-faint'), 'brand-gold': tok('--brand-gold'), 'brand-green': tok('--brand-green'), 'paper': tok('--paper'), 'surface-0': tok('--surface-0') }, probe };
  });
  console.log(JSON.stringify(out, null, 2));
  await page.close(); await b.close();
})();
