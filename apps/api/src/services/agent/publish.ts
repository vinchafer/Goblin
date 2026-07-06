// FEEL-3b B1 — the publish + read_deploy_status adapters (spec §3, §5.1/§5.2).
//
// These are thin adapters over the ALREADY-HARDENED Live-stellen flow and the P0.2
// deploy truth-gate. No new deploy capability: the agent's `publish` runs exactly the
// same pipeline the "Live stellen" button runs —
//   promote drafts → deployToVercel → poll until READY → verifyDeployment (n/6) —
// and returns the FULL verification outcome as a structured tool result, so the report
// is attestable: a verified URL, or the failing check named verbatim. `read_deploy_status`
// exposes the run's current deploy state + last error, feeding the B3 self-heal loop.
//
// Honesty invariant (§5.1): the tool NEVER reports "Live" without a green verifyDeployment.
// A red gate is a structured failure the model sees verbatim — never a silent success.

import { deployToVercel as realDeploy, getDeployStatus as realStatus } from '../vercel-service';
import { verifyDeployment as realVerify } from '../deploy-verification';
import { listFiles as realListFiles } from '../file-storage';
import type { ToolContext, ToolResult } from './types';

/** Injectable deploy dependencies so publish is unit-testable without Vercel/network. */
export interface PublishDeps {
  deployToVercel: typeof realDeploy;
  getDeployStatus: typeof realStatus;
  verifyDeployment: typeof realVerify;
  listFiles: (projectId: string) => Promise<string[]>;
}

export const realPublishDeps: PublishDeps = {
  deployToVercel: realDeploy,
  getDeployStatus: realStatus,
  verifyDeployment: realVerify,
  listFiles: realListFiles,
};

/** Per-run deploy memory shared by publish + read_deploy_status (the run's own view). */
export interface PublishState {
  /** Last verified-live URL this run produced (undefined until a green publish). */
  verifiedUrl?: string;
  /** Last publish failure reason, verbatim (undefined after a green publish). */
  lastError?: string;
  /** Assets that failed their check on the last red gate. */
  lastFailedAssets?: string[];
  /** How many publish attempts this run has made. */
  attempts: number;
}

export function newPublishState(): PublishState {
  return { attempts: 0 };
}

const POLL_DEADLINE_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;

const STATE_DE: Record<string, string> = {
  QUEUED: 'Warteschlange…',
  BUILDING: 'Build läuft…',
  INITIALIZING: 'Build läuft…',
  UPLOADING: 'Dateien werden hochgeladen…',
  DEPLOYING: 'Wird veröffentlicht…',
  READY: 'Bereitstellung abgeschlossen — wird geprüft…',
};

/**
 * Poll the deployment until READY (canonical alias + a URL that answers), mirroring the
 * deploy route (10.6-3). Returns the best URL seen. Throws on ERROR/CANCELED — the caller
 * turns that into a structured failure. `sleep` is injectable so tests don't wait.
 */
async function pollUntilReady(
  deps: PublishDeps,
  userId: string,
  deploymentId: string,
  startUrl: string,
  onProgress: (msg: string) => Promise<void> | void,
  sleep: (ms: number) => Promise<void>,
): Promise<string> {
  let finalUrl = startUrl;
  const deadline = Date.now() + POLL_DEADLINE_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    let status: { state: string; url?: string };
    try {
      status = await deps.getDeployStatus(userId, deploymentId);
    } catch {
      continue; // transient status read failure — keep polling
    }
    if (status.url) finalUrl = status.url;
    await onProgress(STATE_DE[status.state] ?? 'Wird veröffentlicht…');
    if (status.state === 'READY') break;
    if (status.state === 'ERROR' || status.state === 'CANCELED') {
      throw new Error(
        status.state === 'CANCELED'
          ? 'Veröffentlichung wurde abgebrochen.'
          : 'Veröffentlichung fehlgeschlagen (Build-Fehler bei Vercel).',
      );
    }
  }
  return finalUrl;
}

interface PublishRunDeps {
  /** Promote the session's drafts to storage before deploying (so we publish what was written). */
  promoteDrafts: (ctx: ToolContext) => Promise<{ ok: boolean; error?: string }>;
  /** Look up the Vercel project name (deployToVercel keys off it). */
  projectName: (projectId: string) => Promise<string>;
  /** Persist the verified URL on the project row (mirrors the deploy route). */
  markDeployed: (projectId: string, url: string) => Promise<void>;
  /** Sleep (injectable — tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Run one publish: save → deploy → poll → truth-gate. Returns a structured ToolResult
 * AND mutates `state` so read_deploy_status and the self-heal loop see the outcome.
 * Never throws — every failure path is a structured, verbatim-reason ToolResult.
 */
export async function runPublish(
  deps: PublishDeps,
  run: PublishRunDeps,
  ctx: ToolContext,
  state: PublishState,
  onProgress: (msg: string) => Promise<void> | void,
): Promise<ToolResult> {
  const sleep = run.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  state.attempts += 1;

  // 1) Promote drafts so the deployed artifact IS what the model just wrote.
  const promoted = await run.promoteDrafts(ctx);
  if (!promoted.ok) {
    const reason = promoted.error ?? 'Entwürfe konnten vor dem Veröffentlichen nicht gesichert werden.';
    state.lastError = reason;
    return { ok: false, summary: `Veröffentlichen fehlgeschlagen: ${reason}`, error: { code: 'publish_failed', message: reason } };
  }

  // 2) Kick the deploy (may throw NO_VERCEL_TOKEN / build error → structured failure).
  let deploymentId: string;
  let startUrl: string;
  try {
    const res = await deps.deployToVercel(ctx.userId, ctx.projectId, await run.projectName(ctx.projectId), (m) => {
      void onProgress(m);
    });
    deploymentId = res.deploymentId;
    startUrl = res.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Veröffentlichung fehlgeschlagen';
    const code = /NO_VERCEL_TOKEN/.test(msg) ? 'no_vercel_token' : 'deploy_failed';
    state.lastError = msg;
    return { ok: false, summary: 'Veröffentlichen fehlgeschlagen', error: { code, message: msg } };
  }

  // 3) Poll until READY (or a build error).
  let finalUrl: string;
  try {
    finalUrl = await pollUntilReady(deps, ctx.userId, deploymentId, startUrl, onProgress, sleep);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Veröffentlichung fehlgeschlagen';
    state.lastError = msg;
    return { ok: false, summary: 'Veröffentlichen fehlgeschlagen', error: { code: 'deploy_failed', message: msg } };
  }

  // 4) P0.2 truth-gate — the deployed URL must serve the artifact + every referenced asset.
  const deployedPaths = await deps.listFiles(ctx.projectId).catch(() => [] as string[]);
  const verdict = await deps.verifyDeployment(finalUrl, ctx.projectId, deployedPaths, (m) => {
    void onProgress(m);
  });
  if (!verdict.ok) {
    const reason = verdict.reason ?? 'Veröffentlichung konnte nicht bestätigt werden.';
    state.lastError = reason;
    state.lastFailedAssets = verdict.failedAssets;
    return {
      ok: false,
      summary: `Prüfung fehlgeschlagen: ${reason}`,
      error: { code: 'verify_failed', message: reason },
      data: { verified: false, failedAssets: verdict.failedAssets, url: finalUrl },
    };
  }

  // 5) Verified live — persist + return the attested URL.
  await run.markDeployed(ctx.projectId, finalUrl).catch(() => {});
  state.verifiedUrl = finalUrl;
  state.lastError = undefined;
  state.lastFailedAssets = undefined;
  return {
    ok: true,
    summary: `Live ✓ ${finalUrl}`,
    data: { verified: true, url: finalUrl },
  };
}

/** read_deploy_status — the run's current deploy state + last error, verbatim (§3, feeds §5.3). */
export function readDeployStatus(
  state: PublishState,
  project: { previewUrl?: string | null; lastDeployedAt?: string | null },
): ToolResult {
  const live = state.verifiedUrl ?? project.previewUrl ?? null;
  const status = state.lastError ? 'fehlgeschlagen' : live ? 'live' : 'nicht veröffentlicht';
  return {
    ok: true,
    summary: state.lastError ? `Status: ${status} — ${state.lastError}` : `Status: ${status}${live ? ` · ${live}` : ''}`,
    data: {
      status,
      url: live,
      lastDeployedAt: project.lastDeployedAt ?? null,
      lastError: state.lastError ?? null,
      failedAssets: state.lastFailedAssets ?? [],
      attempts: state.attempts,
    },
  };
}
