// Shared evidence helpers for Sprint P1 — local stack (web:3100, api:3001).
// Login via test-callback (recipe: goblin-local-e2e-browser).
import fs from 'node:fs';

const REPO = 'C:/Claude Projekte/12 - Goblin/02 - Webapp';
export const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100';

export function env() {
  const raw = fs.readFileSync(`${REPO}/.env.local`, 'utf8');
  const m = {};
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) m[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return {
    url: m.NEXT_PUBLIC_SUPABASE_URL,
    anon: m.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: m.SUPABASE_SERVICE_ROLE_KEY,
    email: m.TEST_ACCOUNT_EMAIL || 'vinc.hafner3@gmail.com',
  };
}

// Mint a real user session: admin generate_link -> email_otp -> anon verify.
export async function mintSession() {
  const e = env();
  const gl = await fetch(`${e.url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: e.service, Authorization: `Bearer ${e.service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: e.email }),
  });
  if (!gl.ok) throw new Error(`generate_link ${gl.status}: ${await gl.text()}`);
  const glj = await gl.json();
  const otp = glj.email_otp || glj.properties?.email_otp;
  if (!otp) throw new Error(`no email_otp in ${JSON.stringify(glj).slice(0, 300)}`);
  const vr = await fetch(`${e.url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: e.anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: e.email, token: otp }),
  });
  if (!vr.ok) throw new Error(`verify ${vr.status}: ${await vr.text()}`);
  const vj = await vr.json();
  if (!vj.access_token) throw new Error(`no access_token: ${JSON.stringify(vj).slice(0, 200)}`);
  return { access_token: vj.access_token, refresh_token: vj.refresh_token, user: vj.user };
}

// New context pre-seeded with theme + lang + preview flags, logged in.
export async function loginContext(browser, { width, height, theme = 'dark', lang = 'de' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([th, lg]) => {
    try {
      localStorage.setItem('goblin_theme', th);
      localStorage.setItem('goblin:preferred-lang', lg); // the real i18n key (use-lang.ts)
      localStorage.setItem('goblin:preview-onboarding', '1');
    } catch {}
  }, [theme, lang]);
  const s = await mintSession();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/test-callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/dashboard/, { timeout: 90000 }).catch(() => {});
  return { ctx, page, session: s };
}

export const OUT = `${REPO}/_sprint/p1/evidence`;
