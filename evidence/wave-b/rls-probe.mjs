#!/usr/bin/env node
// WAVE-B B3 — adversarial RLS probe against a PROVISIONED backend (the proof app's `tasks`
// table). Proves the verbatim guarantee "jeder sieht nur seine Aufgaben": with two app-level
// users A and B in ONE provisioned Supabase project, user B must NOT be able to read, update,
// or delete user A's rows, nor insert a row as A. Every cell must come back DENIED (RLS hides
// on read → empty; rejects the write → 401/403/0-rows). One leak → exit 1.
//
// This is an ADVERSARIAL, attempted-and-denied test, not an assumption: B actively tries to
// reach A's data by A's real row id, and the probe fails loudly if any attempt succeeds.
//
// Secretless: no keys committed. Supplied at RUNTIME via env (all PUBLIC anon material + two
// app-level test logins — NOT the founder's account, NOT any service_role key):
//
//   PROOF_SUPABASE_URL          the provisioned project URL (https://<ref>.supabase.co)
//   PROOF_SUPABASE_ANON_KEY     the project's PUBLIC anon key
//   RLS_USER_A_JWT | RLS_USER_A_EMAIL + RLS_USER_A_PASSWORD   (owner)
//   RLS_USER_B_JWT | RLS_USER_B_EMAIL + RLS_USER_B_PASSWORD   (attacker)
//
// Usage:  node evidence/wave-b/rls-probe.mjs
// Exit:   0 = every cross-user access denied (PASS)   1 = a leak (FAIL)   2 = SKIPPED (creds).

const SUPABASE_URL = process.env.PROOF_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.PROOF_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function skip(reason) {
  console.log(`\n⏭️  SKIPPED — ${reason}`);
  console.log('   Live-UNVERIFIED. Provide PROOF_SUPABASE_URL + PROOF_SUPABASE_ANON_KEY and the');
  console.log('   two app-level test logins (RLS_USER_A_* / RLS_USER_B_*) to run the live probe.');
  process.exit(2);
}

if (!SUPABASE_URL || !ANON_KEY) skip('PROOF_SUPABASE_URL / PROOF_SUPABASE_ANON_KEY not set');

const base = SUPABASE_URL.replace(/\/$/, '');
const rest = (path) => `${base}/rest/v1/${path}`;
const authUrl = `${base}/auth/v1/token?grant_type=password`;

async function mintJwt(prefix) {
  const direct = process.env[`${prefix}_JWT`];
  if (direct) return direct;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { console.error(`   auth failed for ${prefix}: HTTP ${res.status}`); return null; }
  const body = await res.json();
  return body.access_token ?? null;
}

// Decode the `sub` (user id) from a JWT without verifying (we only need the id to attempt a
// forged insert as the other user).
function jwtSub(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));
    return payload.sub ?? null;
  } catch { return null; }
}

async function get(jwt, path) {
  const res = await fetch(rest(path), { headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` } });
  let rows = []; try { rows = await res.json(); } catch { rows = []; }
  return { status: res.status, rows: Array.isArray(rows) ? rows : [] };
}
async function mutate(jwt, method, path, body) {
  const res = await fetch(rest(path), {
    method,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let rows = []; try { rows = await res.json(); } catch { rows = []; }
  return { status: res.status, rows: Array.isArray(rows) ? rows : [] };
}

const writeDenied = (r) => r.status === 401 || r.status === 403 || r.rows.length === 0;
const readDenied = (r) => r.rows.length === 0;

async function main() {
  const [aJwt, bJwt] = await Promise.all([mintJwt('RLS_USER_A'), mintJwt('RLS_USER_B')]);
  if (!aJwt) skip('could not obtain user A (owner) JWT');
  if (!bJwt) skip('could not obtain user B (attacker) JWT');
  const aId = jwtSub(aJwt);

  // 1) As A: ensure A has a task, then read its id (RLS permits A to see A's own rows).
  await mutate(aJwt, 'POST', 'tasks', { title: 'A-only secret task', user_id: aId });
  const aTasks = await get(aJwt, 'tasks?select=id&limit=1');
  const aTaskId = aTasks.rows[0]?.id;
  if (!aTaskId) skip('user A has no task row after insert — check the provisioned schema');

  // 2) The matrix — B (attacker) against A's row.
  const cells = [];
  const record = (op, denied, detail) => cells.push({ op, denied, detail });

  record('read-all', readDenied(await get(bJwt, 'tasks?select=id')), 'B lists tasks (must see none of A\'s)');
  record('read-by-id', readDenied(await get(bJwt, `tasks?id=eq.${aTaskId}&select=id`)), 'B reads A\'s task by id');
  record('update', writeDenied(await mutate(bJwt, 'PATCH', `tasks?id=eq.${aTaskId}`, { title: 'hacked' })), 'B updates A\'s task');
  record('delete', writeDenied(await mutate(bJwt, 'DELETE', `tasks?id=eq.${aTaskId}`)), 'B deletes A\'s task');
  record('forge-insert', writeDenied(await mutate(bJwt, 'POST', 'tasks', { title: 'forged as A', user_id: aId })), 'B inserts a row owned by A');

  // 3) Report.
  console.log('\nWAVE-B B3 — adversarial RLS probe (attacker = user B, target = user A\'s rows)\n');
  console.log('  op            result   detail');
  console.log('  ' + '-'.repeat(64));
  let leaks = 0;
  for (const c of cells) {
    if (!c.denied) leaks++;
    console.log(`  ${c.op.padEnd(13)} ${c.denied ? 'DENIED ' : 'LEAK ‼ '}  ${c.detail}`);
  }
  console.log('  ' + '-'.repeat(64));

  if (leaks > 0) {
    console.error(`\n❌ FAIL — ${leaks} cross-user access(es) were NOT denied. RLS is not protecting rows.`);
    process.exit(1);
  }
  console.log(`\n✅ PASS — all ${cells.length} cross-user accesses denied by RLS. A cannot read/alter B's data.`);
  process.exit(0);
}

main().catch((e) => { console.error('probe error:', e?.message ?? e); process.exit(1); });
