/**
 * AKT 2 · PHASE 2 · U2.4 — THE PUBLISH PATH. The first living URL.
 *
 * ── The order, and why it is not negotiable ──────────────────────────────────
 *   1. name        — claim it or refuse honestly
 *   2. artifact    — load what we are about to serve
 *   3. SCAN        — before a single byte reaches R2 (U2.3 / AUP promise)
 *   4. registry    — the row exists BEFORE the upload, so an interrupted publish
 *                    leaves something findable instead of an orphan prefix
 *   5. upload      — R2 apps/{app_id}/
 *   6. route       — KV route:{name}
 *   7. VERIFY      — the public URL, through the router, byte-checked
 *   8. only now    — "live"
 *
 * Steps 3 and 7 are the two that make this different from "upload and hope".
 * Nothing is uploaded before the scan; nothing is called live before the verifier
 * says the public internet agrees.
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
import { scanHostedArtifactAndRecord, type HostedScanFile, type HostedScanVerdict } from './safety/hosted-publish-scan';
import { deleteRoute, getRoute, listAppFiles, opsAppsDomain, putAppFiles, setRoute, type CfAppFile, type CfResult } from './cf-deploy';
import {
  claimOpsApp,
  findOpsAppByName,
  findOpsAppByProject,
  markOpsAppFailed,
  markOpsAppPublished,
  renameOpsApp,
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
  scan: { verdict: 'pass'; scannedFiles: number; hits: number };
}

export interface PublishFailure {
  ok: false;
  stage: PublishStage;
  /** Machine-readable, for tests and the E2E runner. */
  code:
    | 'invalid_name' | 'name_taken' | 'name_released' | 'no_entry' | 'empty_artifact'
    | 'scan_blocked' | 'registry_unavailable' | 'upload_failed' | 'route_failed' | 'not_verified';
  /** German, user-facing, in Max-language. Never a stack trace, never a rule id. */
  message: string;
  /** Present when a scan blocked — the rule ids belong in the log and the appeal. */
  ruleIds?: string[];
  appId?: string;
  name?: string;
  url?: string;
}

export type PublishResult = PublishSuccess | PublishFailure;

export interface PublishDeps {
  listFiles: (projectId: string) => Promise<string[]>;
  getFileBytes: (projectId: string, path: string) => Promise<{ bytes: Buffer } | null>;
  scan: typeof scanHostedArtifactAndRecord;
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
}

export const defaultPublishDeps: PublishDeps = {
  listFiles,
  getFileBytes,
  scan: scanHostedArtifactAndRecord,
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
  const scanFiles: HostedScanFile[] = [];
  let totalBytes = 0;

  for (const path of paths) {
    const got = await deps.getFileBytes(projectId, path).catch(() => null);
    if (!got) continue;
    files.push({ path, bytes: got.bytes });
    totalBytes += got.bytes.length;
    scanFiles.push({
      path,
      bytes: got.bytes.length,
      ...(SCANNABLE_EXT.has(ext(path)) ? { content: got.bytes.toString('utf8') } : {}),
    });
  }

  return { files, scanFiles, totalBytes };
}

// ── Publish ─────────────────────────────────────────────────────────────────

export interface PublishInput {
  userId: string;
  projectId: string;
  /** Only used when the project has no app yet; a republish keeps its name. */
  name: string;
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
  const artifact = await loadArtifact(input.projectId, deps);
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

  // 3. SCAN — before anything is uploaded. A block means nothing went anywhere.
  const scan: HostedScanVerdict = deps.scan(artifact.scanFiles, {
    userId: input.userId,
    projectId: input.projectId,
    appsDomain: domain,
  });
  if (scan.verdict === 'block') {
    logger.warn({ userId: input.userId, projectId: input.projectId, ruleIds: scan.ruleIds }, 'hosted_publish_blocked');
    return fail('scan', 'scan_blocked', scan.message ?? 'Diese Veröffentlichung wurde gestoppt.', { ruleIds: scan.ruleIds });
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

  // 6. ROUTE.
  const route = await deps.setRoute(name, appId, { status: 'active' });
  if (!route.ok) {
    await deps.markOpsAppFailed(appId);
    logger.warn({ appId, name, reason: route.error.code }, 'hosted_publish_route_failed');
    return fail('route', 'route_failed', 'Die Adresse konnte nicht eingerichtet werden. Bitte versuch es gleich noch einmal.', { appId, name, url });
  }

  // 7. VERIFY through the public URL.
  const verification = await deps.verify(url, input.projectId, artifact.files);
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
    scan: { verdict: 'pass', scannedFiles: scan.scannedFiles, hits: scan.hits.length },
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

  const route = await deps.setRoute(newName, app.appId, { status: 'active' });
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
