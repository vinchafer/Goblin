/**
 * AKT 2 · PHASE 2 · U2.8 — the end-to-end run, executed BY THE DEPLOYED API.
 *
 * ── Why it lives here and not in a CC session ────────────────────────────────
 * Exactly the Phase-1 self-test reasoning (OPS_SPIKE_0 §4.4): the Cloudflare
 * credentials exist only in the Railway environment, and a cloud CC session is not
 * a vault. So the founder opens the window, fires ONE authorised request, and
 * reads real numbers — instead of a session ever handling a token, and instead of
 * a phase report quoting numbers nobody measured.
 *
 * ── What it actually does, against the real substrate ────────────────────────
 *   1. preflight     — is the router provisioned at all?
 *   2. scan battery  — the same 9 committed fixtures, re-run on production
 *   3. publish ×5    — five full publish→verify loops through the public URL
 *   4. rename        — new address serves, OLD address answers 410
 *   5. hostile       — a hostile fixture is refused and uploads nothing
 *   6. suspend ×3    — flip, suspended page live, unsuspend restores
 *   7. teardown      — zero orphans, 404, and its own KV keys cleaned up
 *
 * ── Safety rails, because this writes to production ──────────────────────────
 * • Names are always `e2e-<random>`, never anything a builder could own.
 * • project_id is null: the run needs no project and cannot touch one.
 * • It cleans up after itself, INCLUDING the released tombstone a rename leaves,
 *   so the run is repeatable rather than littering the namespace.
 * • It is behind opsGate AND an explicit confirm token — no link, prefetch or
 *   crawler can start it.
 *
 * ── The one thing it measures that no unit test can ──────────────────────────
 * KV propagation. Route writes are eventually consistent with a 60-second read
 * cache, so every public-URL check POLLS and reports how long the change actually
 * took to be visible. That number is the honest answer to "how fast is the
 * emergency stop", and it belongs in the runbook rather than in an assumption.
 */

import {
  deleteRoute,
  getRoute,
  listAppFiles,
  opsAppsDomain,
  putAppFiles,
  setRoute,
  deleteAppFiles,
} from './cf-deploy';
import { scanHostedArtifact, scanHostedArtifactAndRecord, type HostedScanFile } from './safety/hosted-publish-scan';
import { HOSTED_SCAN_FIXTURES } from './safety/hosted-fixtures.generated';
import {
  claimOpsApp,
  findOpsAppById,
  findOpsAppByName,
  markOpsAppFailed,
  markOpsAppPublished,
  renameOpsApp,
} from './ops-apps-store';
import { publishHostedApp, renameHostedApp, type PublishDeps } from './ops-publish';
import { defaultPublishDeps } from './ops-publish';
import { suspendApp, teardownApp, unsuspendApp } from './ops-operator';
import { verifyHostedPublish } from './ops-hosted-verify';
import { routerStatus } from './ops-router-deploy';
import { appUrl } from './ops-app-names';
import { SCANNABLE_EXT } from './safety/scan-rules';
import logger from '../lib/logger';

/** The confirm token the caller must send. Not a secret — a speed bump against accident. */
export const E2E_CONFIRM = 'RUN-E2E';

export interface E2EStep {
  step: string;
  ok: boolean;
  detail: string;
  /** Seconds until a change was visible on the public URL, where that was measured. */
  propagationSec?: number;
}

export interface E2EReport {
  passed: boolean;
  runId: string;
  name: string;
  renamedTo: string;
  url: string;
  /** The numeric gates the phase is judged on. */
  numbers: {
    publishLoops: string;
    scanBattery: string;
    suspensionRoundTrip: string;
  };
  steps: E2EStep[];
  /** Anything true that the numbers alone would not tell the founder. */
  notes: string[];
  startedAt: string;
  tookMs: number;
}

/** The benign artifact the run publishes. Small, real, and its own proof of content. */
function testArtifact(runId: string): Record<string, string> {
  return {
    'index.html':
      `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Goblin E2E ${runId}</title>` +
      `<link rel="stylesheet" href="style.css"></head><body><h1>Goblin E2E ${runId}</h1>` +
      `<p>Diese Seite gehört zum automatischen Ende-zu-Ende-Lauf und wird danach entfernt.</p>` +
      `<script src="app.js"></script></body></html>`,
    'style.css': `body{font-family:system-ui;max-width:36rem;margin:4rem auto}/* ${runId} */`,
    'app.js': `console.log(${JSON.stringify(runId)});`,
  };
}

function ext(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

/**
 * Publish deps that serve a SYNTHETIC artifact instead of a project's files.
 * Everything else — scan, R2, KV, verifier, registry — is the real thing, so what
 * runs here is the production publish path and not a rehearsal of it.
 */
function e2eDeps(files: Record<string, string>): PublishDeps {
  return {
    ...defaultPublishDeps,
    listFiles: async () => Object.keys(files),
    getFileBytes: async (_projectId: string, path: string) =>
      files[path] === undefined ? null : { bytes: Buffer.from(files[path]!, 'utf8') },
    // The run owns no project, so "has this project published before?" is always
    // no. Republish idempotency is exercised explicitly instead (see below).
    findOpsAppByProject: async () => null,
    // The verifier compares the served entry against STORAGE; there is no storage
    // here, so the byte check runs against what we uploaded instead. Same gate,
    // sourced from the artifact this run actually created.
    verify: async (url, _projectId, uploaded) => verifyHostedPublish(url, '', uploaded, { attempts: 8, retryDelayMs: 5_000 }),
    claimOpsApp,
    findOpsAppByName,
    markOpsAppPublished,
    markOpsAppFailed,
    renameOpsApp,
    putAppFiles,
    setRoute,
    getRoute,
    deleteRoute,
    appsDomain: opsAppsDomain,
  };
}

/** Poll a URL until it answers the expected status, reporting how long it took. */
async function pollFor(
  url: string,
  want: number,
  opts: { attempts?: number; delayMs?: number; contains?: string } = {},
): Promise<{ ok: boolean; status: number; sec: number; body: string }> {
  const attempts = opts.attempts ?? 20;
  const delayMs = opts.delayMs ?? 5_000;
  const started = Date.now();
  let status = 0;
  let body = '';
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'goblin-e2e/1.0' } });
      status = res.status;
      body = await res.text().catch(() => '');
      if (status === want && (!opts.contains || body.includes(opts.contains))) {
        return { ok: true, status, sec: Math.round((Date.now() - started) / 1000), body };
      }
    } catch {
      status = 0;
    }
  }
  return { ok: false, status, sec: Math.round((Date.now() - started) / 1000), body };
}

function toScanFiles(files: Record<string, string>): HostedScanFile[] {
  return Object.entries(files).map(([path, content]) => ({
    path,
    bytes: Buffer.byteLength(content),
    ...(SCANNABLE_EXT.has(ext(path)) ? { content } : {}),
  }));
}

/** The battery, re-run on production against the same nine committed artifacts. */
export function runScanBattery(): { correct: number; total: number; wrong: string[] } {
  const wrong: string[] = [];
  const names = Object.keys(HOSTED_SCAN_FIXTURES).sort();
  for (const name of names) {
    const want = name.startsWith('hostile-') ? 'block' : 'pass';
    const got = scanHostedArtifact(toScanFiles(HOSTED_SCAN_FIXTURES[name]!)).verdict;
    if (got !== want) wrong.push(`${name}: expected ${want}, got ${got}`);
  }
  return { correct: names.length - wrong.length, total: names.length, wrong };
}

export interface E2EOptions {
  userId: string;
  actor: string;
  /** How many publish→verify loops. The gate is 5. */
  loops?: number;
}

/**
 * Run the whole loop. Never throws: the report IS the answer, including when the
 * answer is "this failed at step 4".
 */
export async function runOpsE2E(opts: E2EOptions): Promise<E2EReport> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const runId = Math.random().toString(36).slice(2, 8);
  const name = `e2e-${runId}`;
  const renamedTo = `e2e-${runId}-b`;
  const domain = opsAppsDomain();
  const url = appUrl(name, domain);
  const newUrl = appUrl(renamedTo, domain);

  const steps: E2EStep[] = [];
  const notes: string[] = [];
  const add = (step: string, ok: boolean, detail: string, propagationSec?: number) => {
    steps.push({ step, ok, detail, ...(propagationSec !== undefined ? { propagationSec } : {}) });
    logger.warn({ step, ok, detail }, 'ops_e2e_step');
    return ok;
  };

  const files = testArtifact(runId);
  const loops = Math.min(Math.max(opts.loops ?? 5, 1), 10);
  let publishOk = 0;
  let suspensionOk = 0;
  let appId = '';

  // 1. PREFLIGHT.
  const router = await routerStatus();
  const reachable = router.workerDeployed === true && router.wildcardProxied === true && router.routeBound === true;
  add('preflight:router', reachable, reachable ? 'router deployed, wildcard proxied, route bound' : `router not fully provisioned — ${router.notes.join('; ') || 'see GET /api/ops/router'}`);
  if (!reachable) {
    notes.push('BLOCKED-ON-DNS: the public-URL steps were NOT run, because nothing would have answered them. Run POST /api/ops/router/provision first.');
  }

  // 2. SCAN BATTERY — pure, so it runs whether or not DNS is up.
  const battery = runScanBattery();
  add('scan:battery', battery.correct === battery.total, `${battery.correct}/${battery.total}${battery.wrong.length ? ` — ${battery.wrong.join(' · ')}` : ''}`);

  if (!reachable) {
    return finish();
  }

  // 3. PUBLISH LOOPS.
  const deps = e2eDeps(files);
  for (let i = 1; i <= loops; i++) {
    // Loop 1 claims the name; loops 2..n exercise re-publish over the same app.
    const loopDeps: PublishDeps = i === 1 ? deps : { ...deps, findOpsAppByProject: async () => (appId ? await findOpsAppById(appId) : null) };
    const result = await publishHostedApp({ userId: opts.userId, projectId: '', name }, loopDeps);
    if (result.ok) {
      appId = result.appId;
      publishOk += 1;
      add(`publish:${i}/${loops}`, true, `live at ${result.url} (${result.files} files, verified ${result.verification.assetsMatched}/${result.verification.assetsChecked} assets byte-identical)`);
    } else {
      add(`publish:${i}/${loops}`, false, `${result.stage}/${result.code}: ${result.message}`);
      break;
    }
  }

  if (!appId) return finish();

  // 4. THE PUBLIC URL — the actual point of the phase.
  const live = await pollFor(url, 200, { contains: runId });
  add('public:serves', live.ok, live.ok ? `${url} → 200 and contains the run marker` : `${url} → ${live.status} after ${live.sec}s`, live.sec);

  // 5. RENAME — the new address serves, the old one answers 410 and does NOT redirect.
  const app = await findOpsAppById(appId);
  if (app) {
    const renamed = await renameHostedApp(app, renamedTo, deps);
    add('rename', renamed.ok, renamed.ok ? `${app.appName} → ${renamedTo}` : (renamed.message ?? 'rename failed'));
    if (renamed.ok) {
      const gone = await pollFor(url, 410);
      add('rename:old-410', gone.ok, gone.ok ? `${url} → 410 (no redirect)` : `${url} → ${gone.status} after ${gone.sec}s`, gone.sec);
      const moved = await pollFor(newUrl, 200, { contains: runId });
      add('rename:new-200', moved.ok, moved.ok ? `${newUrl} → 200` : `${newUrl} → ${moved.status} after ${moved.sec}s`, moved.sec);
    }
  }

  // 6. HOSTILE — refused, and nothing uploaded.
  const hostile = HOSTED_SCAN_FIXTURES['hostile-01-paypal-phish']!;
  const hostileResult = await publishHostedApp(
    { userId: opts.userId, projectId: '', name: `e2e-${runId}-x` },
    { ...e2eDeps({ ...hostile }), findOpsAppByProject: async () => null },
  );
  const blocked = !hostileResult.ok && hostileResult.code === 'scan_blocked';
  add('hostile:blocked', blocked, blocked ? `refused at the scan: ${(hostileResult as { ruleIds?: string[] }).ruleIds?.join(', ')}` : 'A HOSTILE FIXTURE WAS NOT BLOCKED — phase fail');
  const hostileRoute = await getRoute(`e2e-${runId}-x`);
  const nothingWritten = hostileRoute.ok && hostileRoute.value === null;
  add('hostile:nothing-written', nothingWritten, nothingWritten ? 'no KV route was created for the blocked publish' : 'a route exists for a blocked publish');

  // 7. SUSPENSION ROUND-TRIP (the 3/3).
  const current = await findOpsAppById(appId);
  if (current) {
    const suspended = await suspendApp(current, opts.actor, 'E2E-Lauf — automatischer Test, keine echte Sperre');
    if (add('suspend:flip', suspended.ok, `route ${suspended.route}, registry ${suspended.registry}, audit ${suspended.audit}`)) suspensionOk += 1;
    if (suspended.audit === 'unavailable') {
      notes.push('Audit-Zeilen konnten nicht geschrieben werden: Migration 0100 ist noch nicht angewendet. Die Aktionen stehen im Anwendungs-Log.');
    }

    const page = await pollFor(newUrl, 403, { contains: 'gesperrt' });
    if (add('suspend:page-live', page.ok, page.ok ? `${newUrl} → 403 with the suspended page` : `${newUrl} → ${page.status} after ${page.sec}s`, page.sec)) suspensionOk += 1;

    const back = await findOpsAppById(appId);
    if (back) {
      const unsuspended = await unsuspendApp(back, opts.actor, 'E2E-Lauf — Ende des Tests');
      const restored = await pollFor(newUrl, 200, { contains: runId });
      if (add('unsuspend:restored', unsuspended.ok && restored.ok, unsuspended.ok && restored.ok ? `${newUrl} → 200 again` : `unsuspend ${unsuspended.ok}, page ${restored.status}`, restored.sec)) suspensionOk += 1;
    }
  }

  // 8. TEARDOWN — and its own litter.
  const toTearDown = await findOpsAppById(appId);
  if (toTearDown) {
    const torn = await teardownApp(toTearDown, opts.actor, 'E2E-Lauf — Aufräumen');
    add('teardown', torn.ok, `${torn.filesDeleted} Dateien in ${torn.batches} Batch(es), Reste: ${torn.orphansRemaining}, Route weg: ${torn.routeGone}`);
    const dead = await pollFor(newUrl, 404);
    add('teardown:404', dead.ok, dead.ok ? `${newUrl} → 404` : `${newUrl} → ${dead.status} after ${dead.sec}s`, dead.sec);
  }

  // The rename tombstone is this run's litter, not a real app's. Removing it keeps
  // the run repeatable instead of burning a name on every execution.
  const tomb = await deleteRoute(name);
  add('cleanup:tombstone', tomb.ok, tomb.ok ? `released route ${name} removed` : 'tombstone route could not be removed');

  // Belt and braces: if a blocked publish somehow left bytes, say so rather than
  // leaving them for the orphan sweep to find later.
  const strayFiles = await listAppFiles(`${appId}`);
  if (strayFiles.ok && strayFiles.value.length > 0) {
    await deleteAppFiles(appId);
    notes.push(`${strayFiles.value.length} Datei(en) waren nach dem Teardown noch da und wurden nachträglich entfernt.`);
  }

  return finish();

  function finish(): E2EReport {
    const passed = steps.length > 0 && steps.every((s) => s.ok);
    const report: E2EReport = {
      passed,
      runId,
      name,
      renamedTo,
      url,
      numbers: {
        publishLoops: `${publishOk}/${loops}`,
        scanBattery: `${battery.correct}/${battery.total}`,
        suspensionRoundTrip: `${suspensionOk}/3`,
      },
      steps,
      notes,
      startedAt,
      tookMs: Date.now() - started,
    };
    logger.warn({ passed, numbers: report.numbers }, 'ops_e2e_finished');
    return report;
  }
}

export { scanHostedArtifactAndRecord };
