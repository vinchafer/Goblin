/**
 * H1 integration test — GDPR project-storage purge against REAL Backblaze B2.
 *
 * Seeds throwaway objects under UUID-only prefixes (never a real user/project),
 * runs the deletion storage ops, then lists both prefixes to prove they are empty.
 * Also re-runs the project purge to prove idempotency.
 *
 * Run: pnpm --filter @goblin/api exec tsx scripts/h1-purge-integration.mts
 * Requires STORAGE_* env (loaded from repo-root .env.local).
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Repo root is three levels up from apps/api/scripts/.
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../.env.local') });

const {
  uploadBytes,
  deleteUserStorage,
  purgeProjectStorage,
  walkPrefixObjects,
} = await import('../src/services/file-storage.ts');

const lines: string[] = [];
const log = (s: string) => { lines.push(s); console.log(s); };

async function listPrefix(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  await walkPrefixObjects(prefix, (k) => keys.push(k));
  return keys;
}

const stamp = process.argv[2] ?? 'nostamp';
log(`H1 PURGE INTEGRATION — real B2 bucket=${process.env.STORAGE_BUCKET} @ ${stamp}`);
log(`storage endpoint configured: ${process.env.STORAGE_ENDPOINT ? 'yes' : 'NO — running in-memory fallback'}`);

// Throwaway identities — pure UUIDs, cannot collide with a real user/project.
const userId = `h1test-${randomUUID()}`;
const p1 = `h1test-${randomUUID()}`;
const p2 = `h1test-${randomUUID()}`;
log(`\nthrowaway userId=${userId}`);
log(`throwaway projectIds=[${p1}, ${p2}]`);

const seed: Array<[string, string]> = [
  [`users/${userId}/avatar.png`, 'fake-avatar-bytes'],
  [`projects/${p1}/index.html`, '<html>seed p1</html>'],
  [`projects/${p1}/src/app.js`, 'console.log("p1")'],
  [`projects/${p1}/.trash/old.txt`, 'trashed file p1'],       // .trash MUST be purged
  [`projects/${p2}/README.md`, '# seed p2'],
  [`projects/${p2}/.trash/deleted/nested.txt`, 'trashed nested p2'],
];

log('\n--- SEED ---');
for (const [key, body] of seed) {
  await uploadBytes(key, Buffer.from(body), 'application/octet-stream');
  log(`  put ${key}`);
}

// Prove the seed is really there before we delete.
log('\n--- PRE-DELETE LIST ---');
const preUser = await listPrefix(`users/${userId}/`);
const preP1 = await listPrefix(`projects/${p1}/`);
const preP2 = await listPrefix(`projects/${p2}/`);
log(`  users/${userId}/ -> ${preUser.length} objects`);
log(`  projects/${p1}/ -> ${preP1.length} objects (incl .trash: ${preP1.some((k) => k.includes('/.trash/'))})`);
log(`  projects/${p2}/ -> ${preP2.length} objects (incl .trash: ${preP2.some((k) => k.includes('/.trash/'))})`);

// --- RUN DELETION STORAGE OPS (what hardDeleteUser calls) ---
log('\n--- DELETE ---');
const userRemoved = await deleteUserStorage(userId);
log(`  deleteUserStorage removed ${userRemoved} objects`);
const purge = await purgeProjectStorage([p1, p2]);
log(`  purgeProjectStorage: requested=${purge.requested} verifiedEmpty=${purge.purged.length} `
  + `objectsDeleted=${purge.objectsDeleted} failed=${purge.failed.length}`);
if (purge.failed.length) log(`  FAILED: ${JSON.stringify(purge.failed)}`);

// --- VERIFY EMPTY ---
log('\n--- POST-DELETE VERIFY (must all be 0) ---');
const postUser = await listPrefix(`users/${userId}/`);
const postP1 = await listPrefix(`projects/${p1}/`);
const postP2 = await listPrefix(`projects/${p2}/`);
log(`  users/${userId}/ -> ${postUser.length}`);
log(`  projects/${p1}/ -> ${postP1.length}`);
log(`  projects/${p2}/ -> ${postP2.length}`);

// --- IDEMPOTENCY: re-run purge on already-empty prefixes ---
log('\n--- IDEMPOTENCY RE-RUN ---');
const rerun = await purgeProjectStorage([p1, p2]);
log(`  re-run: verifiedEmpty=${rerun.purged.length} objectsDeleted=${rerun.objectsDeleted} failed=${rerun.failed.length}`);

const pass =
  preUser.length > 0 && preP1.length > 0 && preP2.length > 0 &&
  postUser.length === 0 && postP1.length === 0 && postP2.length === 0 &&
  purge.failed.length === 0 && purge.purged.length === 2 &&
  rerun.failed.length === 0 && rerun.purged.length === 2;

log(`\n=== VERDICT: ${pass ? 'PASS' : 'FAIL'} ===`);
log(pass
  ? 'Both users/<id>/ and projects/<id>/ (incl .trash/) verified empty; purge idempotent.'
  : 'One or more prefixes not empty, or seed/idempotency check failed — see above.');

// Emit capture file for sprint evidence.
const outPath = path.resolve(here, '../../../_sprint/hygiene-0705/H1_purge_capture.txt');
const { writeFileSync } = await import('node:fs');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`\nwrote ${outPath}`);

process.exit(pass ? 0 : 1);
