/**
 * AKT 2 · PHASE 2 · U2.4 — THE PUBLISH PATH. The first living URL.
 *
 * ── The order, and why it is not negotiable ──────────────────────────────────
 *   1. name        — claim it or refuse honestly
 *   2. artifact    — load what we are about to serve
 *   2b. FORMS      — (Phase 4) wire any form the app declares, BEFORE the scan
 *   3. SCAN        — before a single byte reaches R2 (U2.3 / AUP promise)
 *   4. registry    — the row exists BEFORE the upload, so an interrupted publish
 *                    leaves something findable instead of an orphan prefix
 *   4b. DATABASE   — (Phase 4) the app's own D1, if it has a form, before the upload
 *   5. upload      — R2 apps/{app_id}/
 *   6. route       — KV route:{name}
 *   7. VERIFY      — the public URL, through the router, byte-checked
 *   8. only now    — "live"
 *
 * Steps 3 and 7 are the two that make this different from "upload and hope".
 * Nothing is uploaded before the scan; nothing is called live before the verifier
 * says the public internet agrees.
 *
 * PHASE 4 slots its two steps AROUND step 3 and step 5 rather than after them, and
 * both placements are load-bearing. The wiring goes before the scan so the injected
 * bytes are scanned like every other byte — no exception for the platform's own
 * snippet. The database goes before the upload so an app whose form cannot be
 * hosted never goes live showing one.
 *
 * ── What this deliberately does NOT do ───────────────────────────────────────
 * It does not build. The artifact is the project's stored files, so a framework
 * project must already contain its built output. A build step on the hosted path
 * is real work with real failure modes and it is not in this phase — stated as an
 * honest limitation rather than half-built.
 *
 * Every dependency is injectable. Not for fashion: the publish path touches B2,
 * R2, KV, Postgres and the public internet, and a test that can only run with all
 * five present is a test that never runs.
 */

import { getFileBytes, listFiles } from './file-storage';
import { runHostedPublishScan, type HostedScanFile, type HostedScanOutcome } from './safety/hosted-publish-scan';
import { reviewMessage } from './safety/review-messages';
import { enqueueReview } from './ops-review-queue';
import { deleteRoute, getRoute, listAppFiles, opsAppsDomain, putAppFiles, setRoute, type CfAppFile, type CfResult } from './cf-deploy';
import {
  claimOpsApp,
  findOpsAppByName,
  findOpsAppByProject,
  markOpsAppFailed,
  markOpsAppPublished,
  renameOpsApp,
  setOpsAppD1Database,
  type OpsApp,
} from './ops-apps-store';
import {
  appUrl,
  checkNameShape,
  NAME_RELEASED_MESSAGE,
  NAME_TAKEN_MESSAGE,
  normalizeName,
  type NameCheck,
} from './ops-app-names';
import { verifyHostedPublish, type HostedVerification, type UploadedFile } from './ops-hosted-verify';
import { wireForms, type WiringResult } from './ops-form-wiring';
import { provisionAppDatabase, teardownAppDatabase } from './ops-d1';
import { dailyRequestBudget } from './ops-caps';
import { SCANNABLE_EXT } from './safety/scan-rules';
import logger from '../lib/logger';

/** The stage a publish reached. A failure names the stage it died at, always. */
export type PublishStage = 'name' | 'artifact' | 'scan' | 'registry' | 'upload' | 'route' | 'verify' | 'live';

export interface PublishSuccess {
  ok: true;
  stage: 'live';
  appId: string;
  name: string;
  url: string;
  files: number;
  bytes: number;
  /** True when this replaced an existing publish rather than creating one. */
  republished: boolean;
  verification: HostedVerification;
  /**
   * `classifier` names what stage 2 did: a `ClassifierReason` when it ran, or
   * `not_run` when it did not. A publish reported live with `classifier: 'skipped'`
   * cleared the deterministic layer only, and the caller must not describe it as
   * having passed both.
   */
  scan: { verdict: 'pass'; scannedFiles: number; hits: number; classifier: string };
  /**
   * PHASE 4 · U4.7 — which forms were wired, and what was deliberately left alone.
   *
   * Reported rather than assumed, because "my form is not connected" is something
   * a builder must be able to learn from the publish result and not from an empty
   * inbox three weeks later. `skipped` carries the forms with their own `action`
   * (Goblin does not overrule an author who said where their form posts) and any
   * this module could not read cleanly.
   */
  forms: { wired: Array<{ path: string; formId: string }>; skipped: Array<{ path: string; why: string }> };
}

export interface PublishFailure {
  ok: false;
  stage: PublishStage;
  /** Machine-readable, for tests and the E2E runner. */
  code:
    | 'invalid_name' | 'name_taken' | 'name_released' | 'no_entry' | 'empty_artifact'
    | 'scan_blocked' | 'scan_review' | 'review_unqueued'
    | 'registry_unavailable' | 'upload_failed' | 'route_failed' | 'not_verified'
    /** PHASE 4 — the app has a form and Goblin cannot host one right now. */
    | 'form_unwirable'
    /** PHASE 4 — the app has a form and its database could not be created or recorded. */
    | 'd1_unavailable';
  /** German, user-facing, in Max-language. Never a stack trace, never a rule id. */
  message: string;
  /** Present when a scan blocked — the rule ids belong in the log and the appeal. */
  ruleIds?: string[];
  /** Present when stage 2 held the publish: the queue row a human will resolve. */
  reviewId?: string;
  appId?: string;
  name?: string;
  url?: string;
}

export type PublishResult = PublishSuccess | PublishFailure;

export interface PublishDeps {
  listFiles: (projectId: string) => Promise<string[]>;
  getFileBytes: (projectId: string, path: string) => Promise<{ bytes: Buffer } | null>;
  scan: typeof runHostedPublishScan;
  enqueueReview: typeof enqueueReview;
  putAppFiles: (appId: string, files: CfAppFile[]) => Promise<CfResult<{ files: number; bytes: number }>>;
  setRoute: typeof setRoute;
  getRoute: typeof getRoute;
  deleteRoute: typeof deleteRoute;
  verify: typeof verifyHostedPublish;
  claimOpsApp: typeof claimOpsApp;
  findOpsAppByName: typeof findOpsAppByName;
  findOpsAppByProject: typeof findOpsAppByProject;
  markOpsAppPublished: typeof markOpsAppPublished;
  markOpsAppFailed: typeof markOpsAppFailed;
  renameOpsApp: typeof renameOpsApp;
  appsDomain: () => string;
  // PHASE 4 — injectable like everything else here: the wiring is pure, and the two
  // D1 calls touch a real Cloudflare account that a test must never reach.
  wireForms: typeof wireForms;
  provisionAppDatabase: typeof provisionAppDatabase;
  setOpsAppD1Database: typeof setOpsAppD1Database;
  teardownAppDatabase: typeof teardownAppDatabase;
}

export const defaultPublishDeps: PublishDeps = {
  listFiles,
  getFileBytes,
  scan: runHostedPublishScan,
  enqueueReview,
  putAppFiles,
  setRoute,
  getRoute,
  deleteRoute,
  verify: verifyHostedPublish,
  claimOpsApp,
  findOpsAppByName,
  findOpsAppByProject,
  markOpsAppPublished,
  markOpsAppFailed,
  renameOpsApp,
  appsDomain: opsAppsDomain,
  wireForms,
  provisionAppDatabase,
  setOpsAppD1Database,
  teardownAppDatabase,
};

function ext(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

function fail(stage: PublishStage, code: PublishFailure['code'], message: string, extra: Partial<PublishFailure> = {}): PublishFailure {
  return { ok: false, stage, code, message, ...extra };
}

// ── Name availability ───────────────────────────────────────────────────────

export interface AvailabilityResult extends NameCheck {
  /** Only meaningful when ok — the URL the name would produce. */
  url?: string;
}

/**
 * Is this name claimable? Shape and reserved list first (no I/O), then the
 * registry, then KV.
 *
 * KV is consulted last and matters most for one case the registry cannot answer:
 * a name RELEASED by a rename. Its row is gone from under that name, but the KV
 * tombstone is still serving 410 to everyone holding an old link. Handing the name
 * to a different builder would silently point those people at content the first
 * owner never chose.
 */
export async function checkNameAvailable(
  raw: string,
  deps: Pick<PublishDeps, 'findOpsAppByName' | 'getRoute' | 'appsDomain'> = defaultPublishDeps,
): Promise<AvailabilityResult> {
  const shape = checkNameShape(raw);
  if (!shape.ok) return shape;
  const name = shape.normalized;

  const existing = await deps.findOpsAppByName(name);
  if (existing) return { ok: false, reason: 'taken', normalized: name, message: NAME_TAKEN_MESSAGE };

  const route = await deps.getRoute(name);
  if (route.ok && route.value) {
    const released = route.value.status === 'released';
    return {
      ok: false,
      reason: released ? 'released' : 'taken',
      normalized: name,
      message: released ? NAME_RELEASED_MESSAGE : NAME_TAKEN_MESSAGE,
    };
  }
  // A KV read that FAILED is not evidence the name is free — but refusing every
  // claim because KV blipped would be worse. The registry already said no, and the
  // unique index is the real arbiter at insert time, so this proceeds and the
  // conflict (if any) surfaces there.

  return { ok: true, normalized: name, url: appUrl(name, deps.appsDomain()) };
}

// ── The artifact ────────────────────────────────────────────────────────────

export interface LoadedArtifact {
  files: UploadedFile[];
  scanFiles: HostedScanFile[];
  totalBytes: number;
}

/**
 * Load the project's stored files as BYTES.
 *
 * Bytes, not strings: an image round-tripped through utf-8 arrives corrupted, and
 * a corrupted image that still answers 200 is exactly the kind of "published
 * successfully" lie the truth gate exists to prevent. Text is decoded separately,
 * only for the scan.
 */
export async function loadArtifact(projectId: string, deps: PublishDeps = defaultPublishDeps): Promise<LoadedArtifact> {
  const paths = await deps.listFiles(projectId);
  const files: UploadedFile[] = [];
  let totalBytes = 0;

  for (const path of paths) {
    const got = await deps.getFileBytes(projectId, path).catch(() => null);
    if (!got) continue;
    files.push({ path, bytes: got.bytes });
    totalBytes += got.bytes.length;
  }

  return { files, scanFiles: describeForScan(files), totalBytes };
}

/**
 * The scan's view of an artifact, derived from the BYTES rather than accumulated
 * alongside them.
 *
 * Phase 4 rewrites some of those bytes (form wiring) between loading and scanning,
 * and a scan description built while loading would then describe the file as it was
 * BEFORE the rewrite — quietly breaking the U2.3 promise that what is scanned is
 * what is uploaded. Deriving it makes that impossible to get wrong: there is one
 * function, and it is called on whatever the final byte array is.
 */
function describeForScan(files: UploadedFile[]): HostedScanFile[] {
  return files.map((f) => ({
    path: f.path,
    bytes: f.bytes.length,
    ...(SCANNABLE_EXT.has(ext(f.path)) ? { content: f.bytes.toString('utf8') } : {}),
  }));
}

// ── Publish ─────────────────────────────────────────────────────────────────

export interface PublishInput {
  userId: string;
  /**
   * The project whose stored files become the app — or `null` for a publish that
   * owns no project.
   *
   * `null` is not a convenience: `ops_apps.project_id` is a NULLABLE uuid (0099), so
   * "no project" has exactly one correct value in the registry and `''` is not it.
   * Postgres rejects `''` for a uuid column (22P02), the insert answers null, and
   * the publish dies at `registry/registry_unavailable` — which is precisely how the
   * E2E run failed while every manual publish, always carrying a real uuid from
   * routes/ops.ts, succeeded on the identical code path. Typing it `string | null`
   * is what makes that state expressible instead of smuggled through an empty
   * string.
   *
   * The only caller that passes null is services/ops-e2e.ts.
   */
  projectId: string | null;
  /** Only used when the project has no app yet; a republish keeps its name. */
  name: string;
  /**
   * PHASE 3 · U3.3 — an operator resolved a review-queue item as approved.
   *
   * Skips stage 2 (see HostedScanContext.operatorApproved). Stage 1 still runs.
   * The ONLY caller is the console's approve action, behind the founder gate; it
   * is not reachable from any builder-facing route.
   */
  operatorApproved?: boolean;
}

/**
 * Publish a project to `{name}.justgoblin.app`.
 *
 * Idempotent by design: a project has at most one Living App, so a second call
 * re-uploads into the same app id, keeps the same name and URL, and re-verifies.
 * Publishing twice must not cost a second name or leave the first one orphaned.
 */
export async function publishHostedApp(input: PublishInput, deps: PublishDeps = defaultPublishDeps): Promise<PublishResult> {
  const domain = deps.appsDomain();

  // The file/verify deps are keyed by project and typed `string`; a publish with no
  // project replaces all of them (ops-e2e.ts serves a synthetic artifact and
  // verifies against what it uploaded), so what they receive here is inert. The
  // value that is NOT inert is the one written to the registry and to the event —
  // and that one stays `input.projectId`, null and all. Converting once, here, is
  // what keeps the two from being confused again.
  const projectKey = input.projectId ?? '';

  const existing = await deps.findOpsAppByProject(input.projectId);
  const republished = existing !== null;

  // 1. NAME. A republish keeps the name it already has — the URL people already
  //    have must not move because someone typed something different in a form.
  let name: string;
  if (existing) {
    name = existing.appName;
  } else {
    const availability = await checkNameAvailable(input.name, deps);
    if (!availability.ok) {
      return fail(
        'name',
        availability.reason === 'taken' ? 'name_taken' : availability.reason === 'released' ? 'name_released' : 'invalid_name',
        availability.message ?? 'Dieser Name geht nicht.',
      );
    }
    name = availability.normalized;
  }
  const url = appUrl(name, domain);

  // 2. ARTIFACT.
  const artifact = await loadArtifact(projectKey, deps);
  if (artifact.files.length === 0) {
    return fail('artifact', 'empty_artifact', 'In diesem Projekt liegen noch keine Dateien, die veröffentlicht werden könnten.');
  }
  if (!artifact.files.some((f) => f.path === 'index.html')) {
    return fail(
      'artifact',
      'no_entry',
      'Für die Veröffentlichung braucht die App eine index.html im Hauptordner — das ist die Seite, die Besucher zuerst sehen.',
    );
  }

  // 2b. FORM WIRING (Phase 4 · U4.7) — BEFORE the scan, deliberately.
  //
  //     Phase 2's order says nothing reaches R2 that the scan has not read. The
  //     injected bytes are bytes like any others, so they are injected here and
  //     scanned in step 3 with everything else: WHAT IS SCANNED IS WHAT IS
  //     UPLOADED, with no exception carved out for the platform's own snippet.
  //
  //     A refusal here refuses the PUBLISH. An app whose form cannot work must not
  //     go live showing one — that is the phantom affordance this unit exists to
  //     prevent, and the builder's already-live app (on a republish) stays exactly
  //     as it is because nothing has been written yet.
  const wiring = deps.wireForms(artifact.files);
  if ('ok' in wiring && wiring.ok === false) {
    logger.warn({ userId: input.userId, projectId: input.projectId, code: wiring.code }, 'hosted_publish_form_unwirable');
    return fail('artifact', 'form_unwirable', wiring.message);
  }
  const wired = wiring as WiringResult;
  if (wired.wired.length > 0) {
    artifact.files = wired.files;
    artifact.scanFiles = describeForScan(wired.files);
    artifact.totalBytes = wired.files.reduce((sum, f) => sum + f.bytes.length, 0);
  }

  // 3. SCAN — before anything is uploaded. A block means nothing went anywhere,
  //    and so does a REVIEW: the two differ in who decides next, never in what
  //    reached R2. Both return before step 4, which is the property the KV/R2
  //    read-back in the tests and in the E2E run actually verifies.
  const scan: HostedScanOutcome = await deps.scan(artifact.scanFiles, {
    userId: input.userId,
    // null, not '': this rides into the publish_blocked event, whose project_id is
    // the same nullable-uuid shape as the registry's.
    projectId: input.projectId,
    appsDomain: domain,
    ...(input.operatorApproved ? { operatorApproved: true } : {}),
  });
  if (scan.verdict === 'block') {
    logger.warn({ userId: input.userId, projectId: input.projectId, ruleIds: scan.ruleIds }, 'hosted_publish_blocked');
    return fail('scan', 'scan_blocked', scan.message ?? 'Diese Veröffentlichung wurde gestoppt.', { ruleIds: scan.ruleIds });
  }

  // 3b. THE THIRD VERDICT (Phase 3 · U3.2). Stage 2 held it for a human.
  //
  // A REPUBLISH is held on exactly the same terms as a first publish. The
  // tempting exception — "this app is already live, let the update through" —
  // would make the check trivially bypassable: publish something harmless, then
  // replace it. The app that is already live stays live and untouched, because
  // nothing here has written anything; what does not happen is the update.
  if (scan.verdict === 'review') {
    const s2 = scan.stage2;
    const queued = await deps.enqueueReview({
      userId: input.userId,
      projectId: input.projectId,
      requestedName: name,
      stage1Verdict: 'pass',
      stage1RuleIds: scan.ruleIds,
      stage2Reason: s2?.reason ?? 'unavailable',
      categories: scan.categories,
      stage2Confidence: s2?.confidence ?? 'unknown',
      scannedFiles: scan.scannedFiles,
      scannedBytes: scan.scannedBytes,
      tokensInput: s2?.tokens.input ?? 0,
      tokensOutput: s2?.tokens.output ?? 0,
    });

    if (!queued) {
      // Held, but not recorded — so nobody is going to look. The builder is told
      // that, rather than told to wait for a review that does not exist.
      return fail(
        'scan',
        'review_unqueued',
        reviewMessage(scan.categories, s2?.reason === 'flagged', false),
      );
    }

    return fail('scan', 'scan_review', scan.message ?? reviewMessage(scan.categories, s2?.reason === 'flagged'), {
      reviewId: queued.id,
      name,
    });
  }

  // 4. REGISTRY, before the upload. See ops-apps-store: a write that answers null
  //    is a refusal to publish, never a reason to upload anyway.
  let app: OpsApp | null = existing;
  if (!app) {
    app = await deps.claimOpsApp({ userId: input.userId, projectId: input.projectId, appName: name });
    if (!app) {
      return fail(
        'registry',
        'registry_unavailable',
        'Die Veröffentlichung konnte nicht gestartet werden — der Name ist gerade vergeben worden, oder die App-Registry ist noch nicht eingerichtet.',
      );
    }
  }
  const appId = app.appId;

  // 4b. THE APP'S OWN DATABASE (Phase 4 · U4.1), before the upload.
  //
  //     Order matters for the same reason step 4 does: if the database cannot be
  //     created, nothing may be uploaded and nothing may be routed. A published app
  //     with a visible form and no place to put a submission is a promise Goblin
  //     cannot keep, made to people who never agreed to anything with us.
  //
  //     Provisioned ONCE per app. A republish of a form app reuses the database it
  //     already has — otherwise every republish would abandon a database full of the
  //     owner's submissions, which is the orphan class X1 is about.
  if (wired.wired.length > 0 && !app.d1DatabaseId) {
    const provisioned = await deps.provisionAppDatabase(appId);
    if (!provisioned.ok) {
      await deps.markOpsAppFailed(appId);
      logger.warn({ appId, code: provisioned.code }, 'hosted_publish_d1_failed');
      return fail('registry', 'd1_unavailable', provisioned.message, { appId, name, url });
    }
    // The id has to reach the registry, or the database is an orphan the moment
    // anything else goes wrong: the sweep would only find it by name and the
    // teardown would never see it at all. A registry that will not take it is a
    // failed publish, and the database is torn back down rather than left standing.
    const recorded = await deps.setOpsAppD1Database(appId, provisioned.databaseId);
    if (!recorded) {
      await deps.teardownAppDatabase(provisioned.databaseId);
      await deps.markOpsAppFailed(appId);
      logger.error({ appId }, 'hosted_publish_d1_unrecorded — database torn back down');
      return fail(
        'registry',
        'd1_unavailable',
        'Die Datenablage für die Formulare dieser App konnte nicht vermerkt werden. '
        + 'Die App wurde deshalb NICHT veröffentlicht. Bitte versuch es gleich noch einmal.',
        { appId, name, url },
      );
    }
  }

  // 5. UPLOAD.
  const upload = await deps.putAppFiles(
    appId,
    artifact.files.map((f) => ({ path: f.path, content: f.bytes })),
  );
  if (!upload.ok) {
    await deps.markOpsAppFailed(appId);
    logger.warn({ appId, reason: upload.error.code }, 'hosted_publish_upload_failed');
    return fail('upload', 'upload_failed', 'Die Dateien konnten nicht vollständig hochgeladen werden. Bitte versuch es gleich noch einmal.', { appId, name, url });
  }

  // 6. ROUTE. The daily budget rides ON the record: the router must be able to
  //    enforce it from the edge without a database round-trip (U2.6).
  const route = await deps.setRoute(name, appId, {
    status: 'active',
    dailyBudget: dailyRequestBudget(app.capsProfile),
  });
  if (!route.ok) {
    await deps.markOpsAppFailed(appId);
    logger.warn({ appId, name, reason: route.error.code }, 'hosted_publish_route_failed');
    return fail('route', 'route_failed', 'Die Adresse konnte nicht eingerichtet werden. Bitte versuch es gleich noch einmal.', { appId, name, url });
  }

  // 7. VERIFY through the public URL.
  const verification = await deps.verify(url, projectKey, artifact.files);
  if (!verification.ok) {
    await deps.markOpsAppFailed(appId);
    // A NEW app that never verified must not keep a public address: the route is
    // withdrawn so nothing claims to be live. A REPUBLISH keeps its route — the
    // app was already live, its files are already replaced, and pulling the route
    // over a verification hiccup would take down something that works.
    if (!republished) await deps.deleteRoute(name);
    return fail('verify', 'not_verified', verification.reason ?? 'Die App ist noch nicht erreichbar.', { appId, name, url });
  }

  // 8. Only now.
  await deps.markOpsAppPublished(appId, { fileCount: artifact.files.length, totalBytes: artifact.totalBytes, verified: true });
  logger.info({ appId, name, files: artifact.files.length, republished }, 'hosted_publish_live');

  return {
    ok: true,
    stage: 'live',
    appId,
    name,
    url,
    files: artifact.files.length,
    bytes: artifact.totalBytes,
    republished,
    verification,
    scan: {
      verdict: 'pass',
      scannedFiles: scan.scannedFiles,
      hits: scan.stage1.hits.length,
      // Which of the two stages actually ran, so a green publish cannot be read as
      // "both stages cleared it" when stage 2 was switched off or skipped.
      classifier: scan.stage2 ? scan.stage2.reason : 'not_run',
    },
    forms: { wired: wired.wired, skipped: wired.skipped },
  };
}

// ── Rename ──────────────────────────────────────────────────────────────────

export interface RenameResult {
  ok: boolean;
  code?: 'invalid_name' | 'name_taken' | 'name_released' | 'route_failed' | 'registry_unavailable' | 'same_name';
  message?: string;
  oldName?: string;
  newName?: string;
  url?: string;
  /** The old address now answers 410 through this tombstone. */
  tombstoned?: boolean;
}

/**
 * Move a live app to a new name.
 *
 * The old address does NOT redirect and does NOT go blank: its KV record is
 * rewritten as a `released` tombstone, so the router answers an honest 410 to
 * everyone still holding the old link. A redirect would silently send them to
 * whatever the app has become; a deletion would give them a 404 that suggests they
 * mistyped. 410 says the true thing: this address existed and is finished.
 *
 * Order: claim the new route BEFORE tombstoning the old one, so a failure halfway
 * leaves the app reachable at its old address rather than at neither.
 */
export async function renameHostedApp(
  app: OpsApp,
  rawNewName: string,
  deps: PublishDeps = defaultPublishDeps,
): Promise<RenameResult> {
  const domain = deps.appsDomain();
  const newName = normalizeName(rawNewName);

  if (newName === app.appName) {
    return { ok: false, code: 'same_name', message: 'Die App heißt schon so.' };
  }

  const availability = await checkNameAvailable(newName, deps);
  if (!availability.ok) {
    return {
      ok: false,
      code: availability.reason === 'taken' ? 'name_taken' : availability.reason === 'released' ? 'name_released' : 'invalid_name',
      message: availability.message ?? 'Dieser Name geht nicht.',
    };
  }

  const route = await deps.setRoute(newName, app.appId, {
    status: 'active',
    dailyBudget: dailyRequestBudget(app.capsProfile),
  });
  if (!route.ok) {
    return { ok: false, code: 'route_failed', message: 'Die neue Adresse konnte nicht eingerichtet werden. Die App ist unter der alten Adresse weiter erreichbar.' };
  }

  const renamed = await deps.renameOpsApp(app.appId, newName);
  if (!renamed) {
    // The registry is the source of truth for ownership. If it did not move, undo
    // the new route rather than leave two addresses pointing at one app with the
    // registry disagreeing about which is real.
    await deps.deleteRoute(newName);
    return { ok: false, code: 'registry_unavailable', message: 'Die Umbenennung konnte nicht gespeichert werden. Die App ist unter der alten Adresse weiter erreichbar.' };
  }

  // The tombstone. Written with the app id it USED to point at, so an operator
  // reading KV can still see where that address led.
  const tomb = await deps.setRoute(app.appName, app.appId, { status: 'released' });
  if (!tomb.ok) {
    logger.warn({ appId: app.appId, oldName: app.appName, reason: tomb.error.code }, 'hosted_rename_tombstone_failed');
  }

  logger.info({ appId: app.appId, from: app.appName, to: newName }, 'hosted_app_renamed');
  return {
    ok: true,
    oldName: app.appName,
    newName,
    url: appUrl(newName, domain),
    tombstoned: tomb.ok,
  };
}

/** Files currently stored for an app — the orphan check and the evidence read. */
export async function storedFilesFor(appId: string) {
  return listAppFiles(appId);
}
