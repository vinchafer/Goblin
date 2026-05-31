// R4 — v2 Vault round-trip verification.
//
// ⚠️  RUN ONLY AFTER migration 0054 has been applied to the DB
//     (supabase db push). Before that, v2 silently falls back to v1 and this
//     script will (correctly) report encryption_version=1.
//
// What it does (against the TEST USER only, on whatever NEXT_PUBLIC_API_URL /
// Supabase your .env.local points at — currently PROD):
//   1. password-grant auth as the test user
//   2. POST a throwaway BYOK key (provider=openai, label "[R4-VERIFY]") via the
//      real API → exercises encryptApiKeyV2 (the path that needs gen_random_bytes)
//   3. read encryption_version straight from the byok_keys table (service role)
//      → EXPECT 2 after 0054 (was 1 before)
//   4. confirm the key is usable (decrypt round-trip happens server-side on read)
//   5. DELETE the throwaway key → no orphan left
//
// Usage:  node scripts/sprint-4/verify-v2-vault.mjs
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const env = (k) => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD');
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), SRK = env('SUPABASE_SERVICE_ROLE_KEY');
const API = env('NEXT_PUBLIC_API_URL') || 'http://localhost:3001';

const j = async (r) => { try { return await r.json(); } catch { return {}; } };

(async () => {
  // 1. auth
  const tok = await j(await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PW }) }));
  if (!tok.access_token) { console.error('AUTH FAILED'); process.exit(1); }
  const authH = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
  const srH = { apikey: SRK, Authorization: `Bearer ${SRK}` };

  // user id
  const users = await j(await fetch(`${SUPA}/rest/v1/users?email=eq.${encodeURIComponent(EMAIL)}&select=id`, { headers: srH }));
  const userId = users[0]?.id;
  console.log('test user:', userId);

  // 2. create throwaway key
  const created = await j(await fetch(`${API}/api/byok-keys`, { method: 'POST', headers: authH, body: JSON.stringify({ provider: 'openai', label: '[R4-VERIFY]', key: 'sk-r4-verify-throwaway-0000000000000000' }) }));
  const keyId = created.id || created.key?.id;
  console.log('created key:', keyId, created.error ? '(error: ' + created.error + ')' : '');
  if (!keyId) { console.error('CREATE FAILED'); process.exit(1); }

  // 3. read encryption_version from the table
  const rows = await j(await fetch(`${SUPA}/rest/v1/byok_keys?id=eq.${keyId}&select=id,provider,encryption_version`, { headers: srH }));
  const ver = rows[0]?.encryption_version;
  console.log('encryption_version =', ver, ver === 2 ? '✅ v2 (migration 0054 working)' : '❌ still v1 — has 0054 been applied?');

  // 4. round-trip: list keys (server decrypts on read; success => round-trip OK)
  const list = await j(await fetch(`${API}/api/byok-keys`, { headers: authH }));
  const found = Array.isArray(list) ? list.find(k => k.id === keyId) : (list.keys || []).find(k => k.id === keyId);
  console.log('round-trip read:', found ? '✅ key readable' : '❌ not readable');

  // 5. cleanup
  const del = await fetch(`${API}/api/byok-keys/${keyId}`, { method: 'DELETE', headers: authH });
  console.log('cleanup delete:', del.status);
  const after = await j(await fetch(`${SUPA}/rest/v1/byok_keys?id=eq.${keyId}&select=id`, { headers: srH }));
  console.log('orphan check:', after.length === 0 ? '✅ no orphan' : '❌ key still present');

  console.log('\nR4_VERIFY_DONE — expect encryption_version=2 after 0054 is applied.');
})();
