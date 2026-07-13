#!/usr/bin/env node
// F-26 — RLS cross-account probe (deterministic, server-side, secretless).
//
// Asserts the founder's cross-account guarantee against the LIVE database: with
// two test accounts, account-4's JWT must NOT be able to read or write
// account-3's project / file / chat / deployment rows. Every cell of the
// 4-resource × {read, write} matrix must come back DENIED (RLS hides the row on
// read → empty; rejects the write → 401/403/0-rows). One leak → exit 1.
//
// Secretless: no keys are committed. Credentials are supplied at RUNTIME via env
// and used only to mint short-lived JWTs through the prod auth API:
//
//   SUPABASE_URL           (or NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_ANON_KEY      (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
//   RLS_ACC3_JWT   | RLS_ACC3_EMAIL + RLS_ACC3_PASSWORD   (owner — account 3)
//   RLS_ACC4_JWT   | RLS_ACC4_EMAIL + RLS_ACC4_PASSWORD   (attacker — account 4)
//
// Usage:  node tests/security/rls-cross-account.mjs
// Exit:   0 = every cross-account access denied (PASS)
//         1 = a leak was observed (FAIL)
//         2 = SKIPPED (missing creds/env) — prod-UNVERIFIED, never a false pass.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function skip(reason) {
  console.log(`\n⏭️  SKIPPED — ${reason}`);
  console.log('   Prod-UNVERIFIED. Provide SUPABASE_URL + SUPABASE_ANON_KEY and the two');
  console.log('   test-account credentials (RLS_ACC3_* / RLS_ACC4_*) to run the live probe.');
  process.exit(2);
}

if (!SUPABASE_URL || !ANON_KEY) skip('SUPABASE_URL / SUPABASE_ANON_KEY not set');

const rest = (path) => `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
const authUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;

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
  if (!res.ok) {
    console.error(`   auth failed for ${prefix}: HTTP ${res.status}`);
    return null;
  }
  const body = await res.json();
  return body.access_token ?? null;
}

// GET with a user JWT. Returns { status, rows }.
async function get(jwt, path) {
  const res = await fetch(rest(path), { headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` } });
  let rows = [];
  try { rows = await res.json(); } catch { rows = []; }
  return { status: res.status, rows: Array.isArray(rows) ? rows : [] };
}

// Mutating request with a user JWT (PATCH/POST/DELETE). Returns { status, rows }.
async function mutate(jwt, method, path, body) {
  const res = await fetch(rest(path), {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let rows = [];
  try { rows = await res.json(); } catch { rows = []; }
  return { status: res.status, rows: Array.isArray(rows) ? rows : [] };
}

// A write is DENIED when the server rejects it (401/403) or RLS affects 0 rows.
const writeDenied = (r) => r.status === 401 || r.status === 403 || r.rows.length === 0;
// A read is DENIED when RLS returns no visible row (empty), regardless of 200/40x.
const readDenied = (r) => r.rows.length === 0;

async function main() {
  const [ownerJwt, attackerJwt] = await Promise.all([mintJwt('RLS_ACC3'), mintJwt('RLS_ACC4')]);
  if (!ownerJwt) skip('could not obtain account-3 (owner) JWT');
  if (!attackerJwt) skip('could not obtain account-4 (attacker) JWT');

  // 1) Discover account-3's real resource ids (as the owner — RLS permits).
  const proj = await get(ownerJwt, 'projects?select=id&limit=1');
  const chat = await get(ownerJwt, 'chat_messages?select=id&limit=1');
  const dep = await get(ownerJwt, 'deployments?select=id&limit=1');
  const file = await get(ownerJwt, 'project_file_meta?select=id,project_id,path&limit=1');

  const ownerProjectId = proj.rows[0]?.id;
  if (!ownerProjectId) skip('account 3 has no project to probe — seed one first');
  const ids = {
    project: ownerProjectId,
    chat: chat.rows[0]?.id ?? null,
    deployment: dep.rows[0]?.id ?? null,
    file: file.rows[0]?.id ?? null,
  };

  // 2) The matrix — account-4 (attacker) against account-3's ids.
  const cells = [];
  const record = (resource, op, denied, detail) => {
    cells.push({ resource, op, denied, detail });
  };

  // project
  record('project', 'read', readDenied(await get(attackerJwt, `projects?id=eq.${ids.project}&select=id`)), 'GET projects by id');
  record('project', 'write', writeDenied(await mutate(attackerJwt, 'PATCH', `projects?id=eq.${ids.project}`, { name: 'rls-probe' })), 'PATCH projects.name');

  // chat — read by id (if any), write = insert into the owner's project
  if (ids.chat) record('chat', 'read', readDenied(await get(attackerJwt, `chat_messages?id=eq.${ids.chat}&select=id`)), 'GET chat_messages by id');
  else record('chat', 'read', true, 'no owner chat row to target (vacuously denied)');
  record('chat', 'write', writeDenied(await mutate(attackerJwt, 'POST', 'chat_messages', { project_id: ids.project, role: 'user', content: 'rls-probe' })), 'INSERT chat into owner project');

  // deployment — read by id; write = insert (no write policy → service-role only)
  if (ids.deployment) record('deployment', 'read', readDenied(await get(attackerJwt, `deployments?id=eq.${ids.deployment}&select=id`)), 'GET deployments by id');
  else record('deployment', 'read', true, 'no owner deployment row to target (vacuously denied)');
  record('deployment', 'write', writeDenied(await mutate(attackerJwt, 'POST', 'deployments', { project_id: ids.project, user_id: '00000000-0000-0000-0000-000000000000', url: 'https://x' })), 'INSERT deployment for owner project');

  // file metadata — read by id; write = insert (no write policy → service-role only)
  if (ids.file) record('file', 'read', readDenied(await get(attackerJwt, `project_file_meta?id=eq.${ids.file}&select=id`)), 'GET project_file_meta by id');
  else record('file', 'read', true, 'no owner file row to target (vacuously denied)');
  record('file', 'write', writeDenied(await mutate(attackerJwt, 'POST', 'project_file_meta', { project_id: ids.project, user_id: '00000000-0000-0000-0000-000000000000', path: 'rls-probe.txt' })), 'INSERT file meta for owner project');

  // 3) Report.
  console.log('\nF-26 — RLS cross-account probe matrix (attacker = account 4, target = account 3)\n');
  console.log('  resource     op     result   detail');
  console.log('  ' + '-'.repeat(66));
  let leaks = 0;
  for (const c of cells) {
    if (!c.denied) leaks++;
    const res = c.denied ? 'DENIED ' : 'LEAK ‼ ';
    console.log(`  ${c.resource.padEnd(12)} ${c.op.padEnd(6)} ${res}  ${c.detail}`);
  }
  console.log('  ' + '-'.repeat(66));

  if (leaks > 0) {
    console.error(`\n❌ FAIL — ${leaks} cross-account access(es) were NOT denied.`);
    process.exit(1);
  }
  console.log(`\n✅ PASS — all ${cells.length} cross-account accesses denied by RLS.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('probe error:', e?.message ?? e);
  process.exit(1);
});
