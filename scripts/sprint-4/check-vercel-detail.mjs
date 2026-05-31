// Quick: does the Vercel connector row resolve past "Lade…"? Probe the API directly + UI after wait.
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const BASE = 'http://localhost:3000';
const env = (k) => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), API = env('NEXT_PUBLIC_API_URL');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0]; const page = await ctx.newPage();
  const d = await (await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON, 'Content-Type': 'application/json' }, data: { email: EMAIL, password: PW } })).json();
  // direct API probe
  const r = await page.request.get(`${API}/api/integrations/vercel`, { headers: { Authorization: `Bearer ${d.access_token}` } });
  console.log('API_URL=' + API);
  console.log('vercel GET status=' + r.status());
  console.log('vercel GET body=' + (await r.text()).slice(0, 300));
  await page.close(); await browser.close();
})();
