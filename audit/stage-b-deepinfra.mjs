#!/usr/bin/env node
/**
 * Layer-2 STAGE B — real DeepInfra reality check (HR-3).
 *
 * Runs 3–5 REAL calls through the DEPLOYED prod API (which holds the wholesale key
 * on Railway). This script never sees or needs DEEPINFRA_API_KEY — it authenticates
 * as a test user and lets prod make the inference call. Server-to-server (no
 * browser, HR-7). Tiny prompts → trivial spend; hard-stops well under the $10.
 *
 * Prereqs (founder, before running):
 *   1. New Session-2 code deployed to the prod API (Railway).
 *   2. Railway:  GOBLIN_HOSTED_API=true,  DEEPINFRA_API_KEY=<real key>.
 *   3. Vercel:   NEXT_PUBLIC_GOBLIN_HOSTED_API=true  (for the picker; not needed by this script).
 *   4. Test account on a plan that includes Forge (pro/power) for the Forge call.
 *
 * Reads from the repo-root .env.local (NOT committed):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD
 * Optional: API_BASE (defaults to the prod Railway API).
 *
 * Usage:  node audit/stage-b-deepinfra.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const txt = readFileSync(join(ROOT, f), 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* file optional */ }
  }
}
loadEnv();

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_ACCOUNT_EMAIL;
const PW = process.env.TEST_ACCOUNT_PASSWORD;
const API = (process.env.API_BASE || 'https://goblinapi-production.up.railway.app').replace(/\/$/, '');

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPA, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, TEST_ACCOUNT_EMAIL: EMAIL, TEST_ACCOUNT_PASSWORD: PW })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}

// Rough DeepInfra list prices (USD per 1M tokens) for the estimate only — real
// billing is the DeepInfra dashboard. Update if the live prices differ.
const PRICE = {
  'goblin/efficient': { in: 0.27, out: 0.40 }, // DeepSeek V3.2 class
  'goblin/premium':   { in: 0.50, out: 2.00 }, // Kimi K2.6 class
};

async function getToken() {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  });
  if (!r.ok) throw new Error(`auth failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token;
}

async function newSession(tok) {
  const r = await fetch(`${API}/api/chat-sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!r.ok) throw new Error(`session create failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).id;
}

/** Stream one real generation, returning the parsed terminal event(s). */
async function streamOnce(tok, sessionId, modelSlug, message) {
  const r = await fetch(`${API}/api/chat-sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, modelSlug }),
  });
  if (!r.ok) return { error: `http ${r.status}: ${(await r.text()).slice(0, 200)}` };

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let meta = null, done = null, error = null, deltas = 0, sample = '';
  while (true) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const data = s.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let p; try { p = JSON.parse(data); } catch { continue; }
      if (p.type === 'meta') meta = p;
      else if (p.type === 'delta') { deltas++; if (sample.length < 80) sample += p.content ?? ''; }
      else if (p.type === 'done') done = p;
      else if (p.type === 'error') error = p;
    }
  }
  return { meta, done, error, deltas, sample };
}

async function usageGoblinCap(tok) {
  const r = await fetch(`${API}/api/users/me/usage`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) return null;
  return (await r.json()).goblinCap ?? null;
}

function fmtCost(slug, tin, tout) {
  const p = PRICE[slug]; if (!p) return 'n/a';
  return `$${((tin / 1e6) * p.in + (tout / 1e6) * p.out).toFixed(6)} (est)`;
}

(async () => {
  console.log(`Stage B → ${API}`);
  const tok = await getToken();
  console.log('✓ authenticated as test user');

  // Confirm prod is actually live on Layer 2 before spending.
  const pre = await fetch(`${API}/health/deep`).then((r) => r.json()).catch(() => null);
  const gh = pre?.checks?.goblin_hosted;
  console.log(`health goblin_hosted:`, gh ?? '(field absent — old deploy?)');
  if (!gh || gh.state !== 'active') {
    console.error('✗ goblin_hosted is not active on prod. Flip GOBLIN_HOSTED_API=true + set DEEPINFRA_API_KEY on Railway and redeploy first. Aborting (no spend).');
    process.exit(2);
  }

  const sid = await newSession(tok);
  console.log(`✓ session ${sid}\n`);

  const before = await usageGoblinCap(tok);
  let totalIn = 0, totalOut = 0;
  const calls = [
    ['goblin/efficient', 'In one short sentence, what is a goblin?'],
    ['goblin/premium',   'Name three primary colors. One word each.'],
    ['goblin/efficient', 'Reply with exactly the word: ok'],
  ];

  for (const [slug, msg] of calls) {
    const res = await streamOnce(tok, sid, slug, msg);
    if (res.error) { console.log(`✗ ${slug}: ${res.error.message ?? res.error}`); continue; }
    const tin = res.done?.input_tokens ?? 0, tout = res.done?.output_tokens ?? 0;
    totalIn += tin; totalOut += tout;
    console.log(`✓ ${slug}`);
    console.log(`   meta.model=${res.meta?.model}  source_tier=${res.meta?.source_tier}`);
    console.log(`   deltas=${res.deltas}  tokens in/out=${tin}/${tout}  ${fmtCost(slug, tin, tout)}`);
    console.log(`   reply: ${JSON.stringify((res.sample || '').slice(0, 70))}`);
    // Two-level truth: provider slug must never appear in the client stream.
    const leak = /deepseek|deepinfra|kimi|moonshot/i.test(JSON.stringify(res));
    console.log(`   provider-slug leak in stream: ${leak ? 'YES ⚠️' : 'no'}`);
    console.log('');
  }

  const after = await usageGoblinCap(tok);
  console.log('cap before:', before ? `${before.usedTokens}/${before.capTokens} (${before.percent}%)` : 'null');
  console.log('cap after: ', after ? `${after.usedTokens}/${after.capTokens} (${after.percent}%)` : 'null');
  console.log(`\nTOTAL real tokens in/out: ${totalIn}/${totalOut}`);
  const est = (totalIn / 1e6) * 0.4 + (totalOut / 1e6) * 1.2;
  console.log(`Rough total est cost: $${est.toFixed(6)} (confirm on DeepInfra dashboard)`);
  console.log('\nDone. Check the DeepInfra dashboard for the real charged amount + remaining balance.');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
