/**
 * X1 — a deleted project must not leave a Living App serving.
 *
 * ── The hole this closes ──────────────────────────────────────────────────────
 * `ops_apps.project_id` is `ON DELETE CASCADE` (migration 0099). Deleting a Goblin
 * project therefore removed the REGISTRY ROW and nothing else: the R2 prefix stayed,
 * the KV route stayed, and `{name}.justgoblin.app` kept serving to the whole internet
 * with no row pointing at it. Nobody could find it in the console, nobody could
 * suspend it (the operator powers all start from a registry row), and its storage was
 * billed to a project that no longer existed. 0099's own header names this a
 * PHASE-2 OBLIGATION; it was never fulfilled. This file fulfils it.
 *
 * ── Why teardown is a PRECONDITION and not just an ordering ───────────────────
 * The prompt offers two shapes: order the teardown before the cascade, or make a
 * completed teardown a precondition of the delete. Ordering alone is what the delete
 * route ALREADY does for Vercel — teardown first, best-effort, proceed regardless —
 * and that is exactly how an orphan is born. Ordering only decides which step runs
 * first; it says nothing about what happens when the first step fails. A first step
 * whose failure is ignored is not a safeguard, it is a preference.
 *
 * So: both. Teardown runs first AND its VERIFIED completion gates the delete. The
 * project row survives a failed teardown, which matters for one concrete reason —
 * the project row is the only thing that still ties the app to its owner once the
 * registry row cascades away. Keeping it is what makes the failure retryable instead
 * of a permanent orphan. An honest 409 and an intact project beats a cheerful 200
 * and a public URL nobody owns.
 *
 * That is the same posture account-deletion.ts already takes for Vercel deployments
 * and Supabase backends ("teardown not confirmed → BLOCK the cascade, retry next
 * pass"). X1 is not a new rule; it is the existing rule reaching a plane that was
 * built after it.
 *
 * ── What this does NOT gate on ────────────────────────────────────────────────
 * `OPS_HOSTING_ENABLED` and the beta allowlist. Both are about who may PUBLISH.
 * Teardown must keep working when Act 2 is dark, for the same reason the operator
 * powers do (ops-operator.ts header): the router serves from KV and R2 and never
 * asks the API anything, so turning the API surface off does not take a single app
 * offline. Gating teardown on the kill switch would mean flipping Act 2 dark
 * re-opens X1 for every delete that follows.
 *
 * ── Cohort protection ─────────────────────────────────────────────────────────
 * A project with no Living App — every Act-1 project, every project on a pre-0099
 * database, every project of a non-allowlisted account — returns
 * `{ attempted: false, ok: true }` after ONE indexed lookup that already degrades to
 * `null` when the table is absent. No Cloudflare call is made, nothing is written,
 * and the delete proceeds exactly as it did before this file existed.
 */

import { appUrl } from './ops-app-names';
import { opsAppsDomain } from './cf-deploy';
import { detachOpsAppFromProject, findOpsAppForProjectTeardown } from './ops-apps-store';
import { teardownApp } from './ops-operator';
import logger from '../lib/logger';

export interface ProjectAppTeardown {
  /** Was there a Living App at all? `false` = nothing hosted; the common case. */
  attempted: boolean;
  /**
   * Safe to release the project row? `true` when there was nothing to tear down, or
   * when the teardown was VERIFIED complete (R2 prefix re-listed empty, KV route
   * re-read gone). Never `true` on the strength of "the deletes did not throw".
   */
  ok: boolean;
  appId?: string;
  appName?: string;
  appUrl?: string;
  /** German, for the builder. Present only when `ok` is false. */
  message?: string;
  /** Technical, for the log and the operator. */
  detail?: string;
  filesDeleted?: number;
  batches?: number;
  orphansRemaining?: number | null;
  routeGone?: boolean | null;
  /** Did the evidence row land? Passed through verbatim — never collapsed. */
  audit?: 'written' | 'unavailable' | 'failed';
  /** Did the tombstone survive the cascade? See `detachOpsAppFromProject`. */
  detached?: boolean;
}

/**
 * Tear down the Living App published from this project, if there is one.
 *
 * `actor` is the builder's own user id (or `'system'` for the account-deletion cron)
 * — the audit trail must record who caused the takedown, and here that is not an
 * operator.
 */
export async function teardownProjectApp(
  projectId: string,
  actor: string,
  reason = 'Projekt gelöscht',
): Promise<ProjectAppTeardown> {
  // Deliberately NOT the publish lookup: this one also returns an app a previous
  // attempt already marked `deleted` but never confirmed gone. See
  // `findOpsAppForProjectTeardown` — the publish lookup would report "no app" on a
  // retry and let the project row go, orphaning the app the retry came to remove.
  let app;
  try {
    app = await findOpsAppForProjectTeardown(projectId);
  } catch (err) {
    // "I could not ask the registry" is not "there is nothing hosted". Refuse.
    const detail = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, detail }, 'ops_project_teardown: registry lookup failed — project delete refused');
    return {
      attempted: true,
      ok: false,
      message:
        'Es liess sich gerade nicht feststellen, ob dieses Projekt eine veröffentlichte App hat. '
        + 'Das Projekt wurde deshalb NICHT gelöscht — bitte in ein paar Minuten erneut versuchen.',
      detail,
    };
  }
  if (!app) return { attempted: false, ok: true };

  const url = appUrl(app.appName, opsAppsDomain());

  // The Phase-2 path, unchanged: route removed before files (so nothing ever serves
  // a half-deleted app), files deleted in ≤1000-key batches, then the prefix
  // re-listed and the route re-read as PROOF rather than a claim.
  const result = await teardownApp(app, actor, reason, {
    action: 'project_delete_teardown',
    meta: { trigger: 'project_delete', projectId },
  });

  const base: ProjectAppTeardown = {
    attempted: true,
    ok: result.ok,
    appId: app.appId,
    appName: app.appName,
    appUrl: url,
    filesDeleted: result.filesDeleted,
    batches: result.batches,
    orphansRemaining: result.orphansRemaining,
    routeGone: result.routeGone,
    audit: result.audit,
  };

  if (!result.ok) {
    logger.error(
      { projectId, appId: app.appId, orphansRemaining: result.orphansRemaining, routeGone: result.routeGone },
      'ops_project_teardown_incomplete — project delete refused',
    );
    return {
      ...base,
      message:
        `Die veröffentlichte App unter ${url} konnte nicht vollständig entfernt werden. `
        + 'Das Projekt wurde deshalb NICHT gelöscht — sonst bliebe die Adresse online, ohne dass '
        + 'sie noch jemandem zugeordnet wäre. Bitte in ein paar Minuten erneut versuchen.',
      ...(result.warning || result.detail ? { detail: [result.warning, result.detail].filter(Boolean).join(' — ') } : {}),
    };
  }

  // Verified gone. Cut the row loose from the project so the cascade that follows
  // cannot take the tombstone with it — that row is what keeps the name out of
  // circulation and gives the audit trail something to point at.
  //
  // A failure here is NOT a reason to refuse the delete: the app is already off the
  // internet and its files are gone, which is the whole invariant. The cost is a
  // released name, not an orphan, so it is reported and the delete proceeds.
  const detached = await detachOpsAppFromProject(app.appId);
  if (!detached) {
    logger.warn(
      { projectId, appId: app.appId },
      'ops_project_teardown: app detached from project failed — the tombstone will cascade, the name is released',
    );
  }

  return { ...base, detached };
}
