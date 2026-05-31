// Sprint 2 Phase 3 — end-to-end ship-loop proof against the test-Vercel-account.
// Exercises the REAL services: create project (guarded) → write file to storage →
// deployToVercel (Vercel builds) → poll status → fetch live URL (200) → cleanup.
// Run: pnpm --filter @goblin/api exec tsx src/scripts/ship-loop-proof.ts
import '../load-env.js';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveTestUserId, getSupabaseAdmin } from '../lib/supabase.js';
import { uploadFile, deleteProject } from '../services/file-storage.js';
import { deployToVercel, getDeployStatus } from '../services/vercel-service.js';

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const token = process.env.VERCEL_TOKEN_SCOPE!;
const proofDir = fileURLToPath(new URL('../../../../ship-loop-proof/', import.meta.url));
try { mkdirSync(proofDir, { recursive: true }); } catch { /* exists */ }

const HERO = 'Built by Goblin — Ship Loop Proof';
const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${HERO}</title></head>
<body><main><h1>${HERO}</h1><a href="#" role="button">Get started</a></main></body></html>`;

const t0 = Date.now();
const tid = await resolveTestUserId();
if (!tid) { console.error('no test user id'); process.exit(1); }
const supabase = getSupabaseAdmin();

const projectId = randomUUID();
const name = `test-b1-loop-${Date.now()}`;
let deploymentUrl: string | undefined;
let projectCreated = false;

try {
  log(`creating project ${name} (${projectId})`);
  const { error: insErr } = await supabase.from('projects').insert({
    id: projectId, user_id: tid, name, description: 'B1 ship-loop proof', color: '#2D4A2B', status: 'idle',
  });
  if (insErr) throw new Error(`project insert failed: ${insErr.message}`);
  projectCreated = true;

  log('writing index.html to storage (simulates Apply)');
  await uploadFile(projectId, 'index.html', HTML);

  log('deploying to Vercel (Vercel builds server-side)…');
  const { deploymentId, url } = await deployToVercel(tid, projectId, name, (m) => log(`  vercel: ${m}`));
  deploymentUrl = url;
  log(`deployment created: id=${deploymentId} url=${url}`);

  // poll status (max 5 min)
  let state = 'QUEUED';
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const s = await getDeployStatus(tid, deploymentId);
    state = s.state;
    log(`  state: ${state}`);
    if (state === 'READY' || state === 'ERROR' || state === 'CANCELED') break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (state !== 'READY') throw new Error(`deployment did not reach READY (last: ${state})`);

  // New Vercel teams enable Deployment Protection (SSO) by default → anonymous fetch = 401.
  // Disable it on OUR test- project so the proof can verify the page is actually served.
  log('disabling deployment protection on test project…');
  const patch = await fetch(`https://api.vercel.com/v9/projects/${name}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssoProtection: null, passwordProtection: null }),
  });
  log(`  protection PATCH → ${patch.status}`);
  await new Promise((r) => setTimeout(r, 3000));

  // fetch live URL
  log(`fetching live URL ${url}`);
  let httpStatus = 0; let bodyHasHero = false; let html = '';
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { redirect: 'follow' });
    httpStatus = res.status;
    html = await res.text();
    bodyHasHero = html.includes(HERO);
    if (httpStatus === 200 && bodyHasHero) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  log(`live URL → HTTP ${httpStatus}, contains hero text: ${bodyHasHero}`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const proof = { ok: httpStatus === 200 && bodyHasHero, name, projectId, deploymentId, url, httpStatus, bodyHasHero, elapsedSeconds: Number(elapsed) };
  writeFileSync(proofDir + 'proof.json', JSON.stringify(proof, null, 2));
  writeFileSync(proofDir + 'deployed-page.html', html);
  log(`PROOF: ${proof.ok ? 'PASS' : 'FAIL'} in ${elapsed}s — ${url}`);
} catch (err) {
  console.error('PROOF FAILED:', err instanceof Error ? err.message : err);
} finally {
  // cleanup — delete our test- Vercel project + DB project + storage
  log('cleanup…');
  try {
    const del = await fetch(`https://api.vercel.com/v9/projects/${name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    log(`  vercel project delete → ${del.status}`);
  } catch (e) { log(`  vercel delete error: ${(e as Error).message}`); }
  if (projectCreated) {
    try { await deleteProject(projectId); log('  storage cleared'); } catch (e) { log(`  storage clear error: ${(e as Error).message}`); }
    try { await supabase.from('projects').delete().eq('id', projectId); log('  project row deleted'); } catch (e) { log(`  row delete error: ${(e as Error).message}`); }
  }
  log('done');
  process.exit(0);
}
