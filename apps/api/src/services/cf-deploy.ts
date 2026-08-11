/**
 * ACT 2 · PHASE 1 · U1.2 — THE CLOUDFLARE ADAPTER (lean substrate).
 *
 * The one place the platform plane talks to the user-app plane. Everything Act 2
 * does to a user's app — upload it, route to it, take it down — goes through this
 * file, so the blast radius of a substrate change is one module.
 *
 * ── The lean substrate (founder decision 2026-07-27) ──────────────────────────
 * Workers FREE plan. No Workers for Platforms, no dispatch namespace, no per-app
 * Workers, no D1. An app is:
 *   • its static files in R2       → bucket CF_R2_BUCKET, prefix `apps/{appId}/…`
 *   • a route record in KV         → namespace CF_KV_NAMESPACE_ID, key `route:{name}`
 *   • served by ONE platform-owned router Worker (Phase 2) that reads the KV
 *     record for the `{name}` label of `{name}.{OPS_APPS_DOMAIN}` and streams the
 *     matching R2 object.
 * The Free plan's 100,000-requests/day hard stop is the cost ceiling BY DESIGN.
 *
 * ── Substrate-agnostic on purpose ─────────────────────────────────────────────
 * The interface below names what Goblin needs — app files, routes, worker scripts
 * — never what the Free plan happens to permit. Nothing here assumes static-only,
 * one-worker, or no-database. The documented upgrade trigger (the Free limit bites
 * OR an app needs server-side code → Workers Paid / WfP, D1, per-app Workers) is
 * then an added implementation behind the same surface, not a rewrite. That is why
 * deployWorker/getWorker/deleteWorker exist NOW even though the Free plane has no
 * per-app Workers: Phase 2's router is deployed through them, which also proves
 * the token's Workers scope today rather than discovering it is missing later.
 *
 * ── Standing rules this file obeys ────────────────────────────────────────────
 * 1. NO RAW THROWS INTO ROUTES. Every exported function returns CfResult<T>. A
 *    route handler never needs a try/catch around this module.
 * 2. PER-CALL TIMEOUT ON EVERY EXTERNAL CALL (the webhook lesson: an upstream that
 *    never answers must not hold a request open). CF_TIMEOUT_MS, default 10s.
 * 3. BATCHED DESTRUCTIVE OPS (the unbatched-deleteProject anti-pattern, #18): R2
 *    deletes are chunked at the S3 limit of 1000 keys per request, and listing
 *    paginates, so an app with >1000 files deletes completely instead of silently
 *    dropping the tail.
 * 4. NO SECRET MATERIAL LEAVES THIS FILE. Credentials are read from env at call
 *    time and never logged, never returned, never embedded in an error message —
 *    every upstream message is passed through redactSecrets() before it can reach
 *    a caller, a log line or an evidence artifact.
 *
 * Cost: see docs/GOBLIN_CONSUMPTION_LEDGER.md → M-H1 (hosting COGS class).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { unwrapEnv } from '../lib/env-value';
import logger from '../lib/logger';

// ── Result & error types ────────────────────────────────────────────────────

export type CfErrorCode =
  /** A required env var is missing — the adapter is not wired up on this instance. */
  | 'not_configured'
  /** The caller passed something this adapter refuses to send (bad app id, unsafe path). */
  | 'invalid_input'
  /** The upstream did not answer inside CF_TIMEOUT_MS. */
  | 'timeout'
  /** 401/403 — the token is wrong or lacks the scope for this call. */
  | 'auth'
  /** 404 — the object/key/script is not there. */
  | 'not_found'
  /** 429 — Cloudflare is rate-limiting us. */
  | 'rate_limited'
  /** Anything else the upstream said, or a transport failure. */
  | 'upstream';

export interface CfError {
  code: CfErrorCode;
  /** Human-readable, ALWAYS redacted. Safe to log and to put in an evidence file. */
  message: string;
  /** HTTP status, when there was one. */
  status?: number;
}

export type CfResult<T> = { ok: true; value: T } | { ok: false; error: CfError };

const ok = <T>(value: T): CfResult<T> => ({ ok: true, value });
const fail = <T = never>(code: CfErrorCode, message: string, status?: number): CfResult<T> => ({
  ok: false,
  error: { code, message: redactSecrets(message), ...(status !== undefined ? { status } : {}) },
});

// ── Domain types ────────────────────────────────────────────────────────────

/** One file of a user app, addressed by its app-relative path (`index.html`, `assets/app.css`). */
export interface CfAppFile {
  path: string;
  content: string | Uint8Array;
  /** Optional override; otherwise derived from the extension. */
  contentType?: string;
}

/** A stored object of a user app. */
export interface CfStoredFile {
  /** App-relative path (the R2 prefix is stripped). */
  path: string;
  /** Full R2 key, for debugging. */
  key: string;
  size: number;
  etag?: string;
}

/** The bytes of one stored file. */
export interface CfFetchedFile {
  path: string;
  bytes: Uint8Array;
  contentType?: string;
}

/**
 * The KV route record — what the Phase-2 router Worker reads to resolve a
 * hostname label to an app. Deliberately a small JSON object rather than a bare
 * app id so status (suspension, per the abuse SOP) and later fields can be added
 * without a migration of every key.
 */
export interface CfRoute {
  name: string;
  appId: string;
  status: CfRouteStatus;
  /**
   * Requests per UTC day before the router answers 429 (Phase 2 · U2.6). Carried
   * ON THE ROUTE rather than looked up, because the router must not need a database
   * round-trip from the edge — the same reason `status` lives here. Absent means no
   * enforcement, which is stated rather than silently defaulted.
   */
  dailyBudget?: number;
  updatedAt?: string;
}

/**
 * `released` (Phase 2 · U2.4) is a TOMBSTONE, not a deletion: the address of an app
 * that was renamed away. The router answers 410 for it, and the name stays out of
 * circulation, because somebody's bookmark or printed flyer still points there and
 * handing the address to a different builder would silently redirect real people.
 */
export type CfRouteStatus = 'active' | 'suspended' | 'released';

/** A deployed Worker script, as read back from Cloudflare. */
export interface CfWorker {
  scriptName: string;
  /** Size of the returned script body in bytes. */
  size: number;
}

/**
 * A runtime binding attached to a Worker at deploy time — how the router reaches
 * KV and R2 without ever holding a credential of its own.
 *
 * PHASE 2. The router is the first (and on the lean plane, only) Worker that needs
 * these: without them it could only talk to Cloudflare over the REST API, which
 * would mean shipping CF_API_TOKEN into a script that runs on every visitor
 * request. Bindings are the mechanism that keeps the token in Railway.
 */
export type CfBinding =
  | { type: 'kv_namespace'; name: string; namespace_id: string }
  | { type: 'r2_bucket'; name: string; bucket_name: string; jurisdiction?: R2Jurisdiction }
  | { type: 'plain_text'; name: string; text: string };

/**
 * The jurisdictions R2 can pin a bucket to. A bucket created with one lives in a
 * SEPARATE namespace from the default one — same account, different address space
 * — and the jurisdiction cannot be changed after creation.
 *
 * ── Why this had to be settled against live docs rather than recalled ────────
 * Cloudflare's own reference pages disagree, and the disagreement is the whole
 * bug. The Workers multipart-upload metadata reference
 * (https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/,
 * retrieved 2026-08-11) documents the r2_bucket binding as exactly
 * `{type, name, bucket_name}` — no jurisdiction field at all. Reading only that
 * page, an EU bucket is simply unbindable, which is what the 10085 looked like.
 *
 * Three sources say otherwise and they win:
 *
 *   1. R2 data location (https://developers.cloudflare.com/r2/reference/data-location/,
 *      retrieved 2026-08-11): "To access R2 buckets that belong to a jurisdiction
 *      from Workers, you need to specify the jurisdiction as well as the bucket
 *      name as part of your bindings", with `jurisdiction` shown ON the r2_bucket
 *      entry in both JSON and TOML.
 *   2. Wrangler configuration (https://developers.cloudflare.com/workers/wrangler/configuration/,
 *      retrieved 2026-08-11): `jurisdiction` is an optional field of an
 *      `r2_buckets` entry — "The jurisdiction where this R2 bucket is located".
 *   3. Cloudflare's own generated API client, which is the closest thing to the
 *      API's schema that is publicly readable
 *      (https://github.com/cloudflare/cloudflare-typescript, `src/resources/workers/scripts/scripts.ts`,
 *      retrieved 2026-08-11): `WorkersBindingKindR2Bucket` is
 *      `{bucket_name, name, type: 'r2_bucket', jurisdiction?: 'eu' | 'fedramp' | 'fedramp-high'}`.
 *
 * (3) is decisive, because it describes the REST API this adapter actually calls,
 * not wrangler's config file. Wrangler has no private channel here — it uploads
 * through the same script-upload endpoint — so a field wrangler can express must
 * survive the wire. The corroborating evidence is that Cloudflare rejects a bad
 * value with its own error 10021 "invalid jurisdiction" (reported alongside 10085
 * in cloudflare/workers-sdk#9059): an API that did not parse the field could not
 * validate it.
 *
 * MOST DEFENSIBLE READING, stated plainly: the metadata reference page is
 * incomplete, not authoritative-by-omission. The field goes on the binding.
 */
export type R2Jurisdiction = 'eu' | 'fedramp' | 'fedramp-high';

export const R2_JURISDICTIONS: readonly R2Jurisdiction[] = ['eu', 'fedramp', 'fedramp-high'];

/**
 * What `CF_R2_JURISDICTION` says, or why it cannot be honoured.
 *
 * Three-way rather than `R2Jurisdiction | null`, because "unset" and "set to
 * something I do not recognise" must not collapse into the same answer. Unset
 * legitimately means the default namespace. An unrecognised value means the
 * founder was TRYING to say something about data residency and it did not land —
 * and silently treating that as "default namespace" would bind a Worker to the
 * wrong namespace on the strength of a typo. On a page that now names Cloudflare
 * as a sub-processor with R2 in the EU, that is not a config nit.
 */
export type R2JurisdictionRead =
  | { ok: true; jurisdiction: R2Jurisdiction | null }
  | { ok: false; raw: string };

/**
 * Read `CF_R2_JURISDICTION` through the same hardened unwrapper as every other
 * env value here, so a pasted `CF_R2_JURISDICTION="eu"` is read as `eu` and not
 * as the four-character string `"eu"` — which Cloudflare would answer with 10021.
 *
 * Case-folded because a jurisdiction is an identifier the founder types by hand
 * from a dashboard that displays it as "EU".
 *
 * Deliberately NOT added to CF_ENV_VARS: that list is what `/api/ops/health`
 * treats as "every required variable", so a name added there is reported MISSING
 * when unset. Unset is a correct, supported configuration (the default
 * namespace), and a green health report must not turn degraded because of one.
 * Same reasoning, same precedent as OPS_SITE_URL below.
 */
export function r2Jurisdiction(): R2JurisdictionRead {
  const raw = unwrapEnv(process.env.CF_R2_JURISDICTION).toLowerCase();
  if (raw.length === 0) return { ok: true, jurisdiction: null };
  if ((R2_JURISDICTIONS as readonly string[]).includes(raw)) {
    return { ok: true, jurisdiction: raw as R2Jurisdiction };
  }
  return { ok: false, raw };
}

/** A DNS record, as far as this adapter cares. */
export interface CfDnsRecord {
  id: string;
  name: string;
  type: string;
  proxied: boolean;
}

/** A Workers route binding a URL pattern on a zone to a script. */
export interface CfWorkerRoute {
  id: string;
  pattern: string;
  script: string;
}

export interface CfPutResult {
  files: number;
  bytes: number;
}

export interface CfDeleteResult {
  deleted: number;
  /** How many DeleteObjects requests it took — the batching is visible, not assumed. */
  batches: number;
}

// ── Configuration (read at call time, never at module load) ─────────────────

/**
 * Every env var this adapter reads. Exported so the health probe can report
 * PRESENCE by name without ever touching a value.
 *
 * NOT in this list and NOT read by the adapter: CF_R2_API_TOKEN. The R2 S3
 * credentials (CF_R2_ACCESS_KEY_ID / CF_R2_SECRET_ACCESS_KEY) are sufficient for
 * every R2 call here. It exists in the Railway environment as reserved-unused —
 * left untouched deliberately, not forgotten.
 */
export const CF_ENV_VARS = [
  'CF_ACCOUNT_ID',
  'CF_API_TOKEN',
  'CF_R2_ACCESS_KEY_ID',
  'CF_R2_SECRET_ACCESS_KEY',
  'CF_R2_ENDPOINT',
  'CF_R2_BUCKET',
  'CF_KV_NAMESPACE_ID',
  'OPS_APPS_DOMAIN',
] as const;

export type CfEnvVar = (typeof CF_ENV_VARS)[number];

/** Env vars whose VALUES are secret and must be scrubbed from any outbound string. */
const SECRET_ENV_VARS: readonly CfEnvVar[] = [
  'CF_API_TOKEN',
  'CF_R2_ACCESS_KEY_ID',
  'CF_R2_SECRET_ACCESS_KEY',
];

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const DEFAULT_TIMEOUT_MS = 10_000;

/** S3 hard limit: DeleteObjects accepts at most 1000 keys per request. */
const DELETE_BATCH_SIZE = 1000;

function timeoutMs(): number {
  // Unwrapped for the same reason as env() below: Number('"10000"') is NaN, so a
  // pasted-with-quotes override would silently fall back to the default.
  const raw = Number(unwrapEnv(process.env.CF_TIMEOUT_MS));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TIMEOUT_MS;
}

/**
 * The compatibility date stamped on Workers we upload. Fixed (not "today") so a
 * deploy is reproducible and does not silently change runtime semantics with the
 * calendar. Overridable via CF_WORKER_COMPAT_DATE when a Worker needs a newer one.
 */
function workerCompatDate(): string {
  const raw = unwrapEnv(process.env.CF_WORKER_COMPAT_DATE);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '2025-01-01';
}

/**
 * Every credential and identifier this adapter uses, read through PR #77's shared
 * unwrapper rather than a bare `.trim()`.
 *
 * These are all Railway dashboard fields, and a dashboard field is filled by
 * pasting. `CF_R2_BUCKET="goblin-apps"` copied out of a `.env` file or a doc code
 * block keeps its quotes; `.trim()` leaves them on, and the adapter then addresses
 * a bucket that does not exist while the presence probe cheerfully reports the
 * variable as set. Same rule as the web side (`apps/web/lib/env/origin.ts`) and
 * the same rule as every other env parser in this API, so the two cannot drift.
 *
 * It unwraps; it does not validate or repair. An unset variable is still empty and
 * still makes the surface report `not_configured`.
 */
function env(name: CfEnvVar): string {
  return unwrapEnv(process.env[name]);
}

/** Which of the adapter's env vars are present. Booleans only — never a value, never a length. */
export function cfEnvPresence(): Record<CfEnvVar, boolean> {
  const out = {} as Record<CfEnvVar, boolean>;
  for (const name of CF_ENV_VARS) out[name] = env(name).length > 0;
  return out;
}

/** The env vars required for a given surface, so the probe can report per-surface readiness. */
const REQUIRED: Record<'r2' | 'kv' | 'workers', readonly CfEnvVar[]> = {
  r2: ['CF_R2_ENDPOINT', 'CF_R2_BUCKET', 'CF_R2_ACCESS_KEY_ID', 'CF_R2_SECRET_ACCESS_KEY'],
  kv: ['CF_ACCOUNT_ID', 'CF_API_TOKEN', 'CF_KV_NAMESPACE_ID'],
  workers: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
};

function missingFor(surface: keyof typeof REQUIRED): CfEnvVar[] {
  return REQUIRED[surface].filter((name) => env(name).length === 0);
}

/**
 * Replace any occurrence of a secret env VALUE with a marker.
 *
 * The adapter reads secret values (that is its job); nothing it emits may carry
 * one. Cloudflare and the AWS SDK both echo request details into error messages,
 * so this runs on every message that can reach a caller, a log or an artifact.
 * Short values (<8 chars) are skipped — they are not credentials and blanket
 * substitution would mangle unrelated text.
 */
export function redactSecrets(message: string): string {
  let out = message;
  for (const name of SECRET_ENV_VARS) {
    const value = env(name);
    if (value.length >= 8) out = out.split(value).join(`[redacted:${name}]`);
  }
  return out;
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * App ids are ours (uuid or slug), but they compose R2 keys, so they are validated
 * anyway: no traversal, no separators, no surprises.
 */
const APP_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/**
 * Hostname-label shape for a route name. SHAPE ONLY — the reserved-name list,
 * brand-token blocking and homoglyph normalisation are Phase 2's name-claim flow
 * (OPS_SPIKE_0 §3.4), not this adapter's business.
 */
const ROUTE_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Worker script names, per Cloudflare's own naming rules. */
const SCRIPT_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

function badAppId(appId: string): CfError | null {
  return APP_ID_RE.test(appId) ? null : { code: 'invalid_input', message: `invalid app id: ${JSON.stringify(appId)}` };
}

/**
 * App-relative file paths. Rejects absolute paths, traversal, backslashes, NUL and
 * empty segments — the same prefix-jail reasoning as the B2 project store: no
 * caller may compose a key that escapes `apps/{appId}/`.
 */
function badFilePath(path: string): CfError | null {
  if (!path || path.length > 1024) return { code: 'invalid_input', message: 'file path empty or too long' };
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    return { code: 'invalid_input', message: `unsafe file path: ${JSON.stringify(path)}` };
  }
  const segments = path.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    return { code: 'invalid_input', message: `unsafe file path: ${JSON.stringify(path)}` };
  }
  return null;
}

// ── Keys ────────────────────────────────────────────────────────────────────

/** The R2 prefix for one app. The single place this layout is defined. */
export function appPrefix(appId: string): string {
  return `apps/${appId}/`;
}

/**
 * The KV key for one route. Prefixed so the namespace can hold other record types
 * later without collisions. The Phase-2 router Worker MUST use the same builder:
 * `env.ROUTES.get('route:' + label)`.
 */
export function routeKey(name: string): string {
  return `route:${name}`;
}

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  pdf: 'application/pdf',
  xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json',
};

export function contentTypeFor(path: string): string {
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

// ── Timeout wrapper ─────────────────────────────────────────────────────────

class CfTimeoutError extends Error {}

/**
 * Bound any external call. Rule 2: a call that never answers must not hold a
 * request open. The AbortSignal cancels the socket where the client honours it;
 * the race guarantees the caller is released either way.
 */
async function withTimeout<T>(label: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ms = timeoutMs();
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CfTimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Map anything thrown by a client into a typed, redacted CfError. */
function toCfError(label: string, err: unknown): CfError {
  if (err instanceof CfTimeoutError) {
    return { code: 'timeout', message: redactSecrets(err.message) };
  }
  const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = e?.$metadata?.httpStatusCode;
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
    return { code: 'timeout', message: `${label} aborted` };
  }
  if (status === 401 || status === 403) return { code: 'auth', message: `${label}: not authorized`, status };
  if (status === 404) return { code: 'not_found', message: `${label}: not found`, status };
  if (status === 429) return { code: 'rate_limited', message: `${label}: rate limited`, status };
  return {
    code: 'upstream',
    message: redactSecrets(`${label}: ${e?.message ?? String(err)}`),
    ...(status !== undefined ? { status } : {}),
  };
}

// ── R2 (S3 API) ─────────────────────────────────────────────────────────────

let _s3: S3Client | null = null;
let _s3Fingerprint = '';

/**
 * Cached S3 client, invalidated when the credentials change (a Railway rotation
 * redeploys the process, but tests and long-running instances both benefit from
 * not silently holding a stale client).
 */
function getR2Client(): S3Client | null {
  if (missingFor('r2').length > 0) return null;
  const endpointRaw = env('CF_R2_ENDPOINT');
  const endpoint = endpointRaw.startsWith('http') ? endpointRaw : `https://${endpointRaw}`;
  const fingerprint = `${endpoint}|${env('CF_R2_ACCESS_KEY_ID')}|${env('CF_R2_BUCKET')}`;
  if (_s3 && _s3Fingerprint === fingerprint) return _s3;

  const config: S3ClientConfig = {
    endpoint,
    // R2 is region-less; "auto" is Cloudflare's documented value for S3 clients.
    region: 'auto',
    credentials: {
      accessKeyId: env('CF_R2_ACCESS_KEY_ID'),
      secretAccessKey: env('CF_R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  };
  _s3 = new S3Client(config);
  _s3Fingerprint = fingerprint;
  return _s3;
}

/** Test seam: drop the cached client so a test can change credentials mid-run. */
export function __resetCfClientsForTest(): void {
  _s3 = null;
  _s3Fingerprint = '';
}

function r2Unconfigured<T>(): CfResult<T> {
  return fail('not_configured', `R2 not configured — missing: ${missingFor('r2').join(', ')}`);
}

/** HEAD the bucket. The health probe's R2 reachability check. */
export async function checkR2(): Promise<CfResult<{ bucket: string; latencyMs: number }>> {
  const s3 = getR2Client();
  if (!s3) return r2Unconfigured();
  const bucket = env('CF_R2_BUCKET');
  const started = Date.now();
  try {
    await withTimeout('r2:head-bucket', (signal) =>
      s3.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal: signal }),
    );
    return ok({ bucket, latencyMs: Date.now() - started });
  } catch (err) {
    const e = toCfError('r2:head-bucket', err);
    return { ok: false, error: e };
  }
}

/**
 * Upload an app's files under `apps/{appId}/`. Uploads are issued one at a time:
 * an app is a handful of small files, and a serial loop keeps a failure's meaning
 * unambiguous (partial upload reported honestly, no silent half-state).
 */
export async function putAppFiles(appId: string, files: CfAppFile[]): Promise<CfResult<CfPutResult>> {
  const idErr = badAppId(appId);
  if (idErr) return { ok: false, error: idErr };
  if (!Array.isArray(files) || files.length === 0) {
    return fail('invalid_input', 'putAppFiles called with no files');
  }
  for (const f of files) {
    const pathErr = badFilePath(f.path);
    if (pathErr) return { ok: false, error: pathErr };
  }

  const s3 = getR2Client();
  if (!s3) return r2Unconfigured();
  const bucket = env('CF_R2_BUCKET');
  const prefix = appPrefix(appId);

  let bytes = 0;
  let written = 0;
  for (const file of files) {
    const body = typeof file.content === 'string' ? Buffer.from(file.content, 'utf8') : Buffer.from(file.content);
    try {
      await withTimeout(`r2:put ${file.path}`, (signal) =>
        s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: `${prefix}${file.path}`,
            Body: body,
            ContentType: file.contentType ?? contentTypeFor(file.path),
          }),
          { abortSignal: signal },
        ),
      );
    } catch (err) {
      const e = toCfError(`r2:put ${file.path}`, err);
      logger.warn({ appId, written, reason: e.code }, 'cf_put_app_files_failed');
      // Honest partial state: say how far we got, never pretend it was atomic.
      return { ok: false, error: { ...e, message: `${e.message} (after ${written}/${files.length} files)` } };
    }
    written += 1;
    bytes += body.byteLength;
  }
  logger.info({ appId, files: written, bytes }, 'cf_put_app_files');
  return ok({ files: written, bytes });
}

/** List everything stored for an app. Paginated — a >1000-file app lists completely. */
export async function listAppFiles(appId: string): Promise<CfResult<CfStoredFile[]>> {
  const idErr = badAppId(appId);
  if (idErr) return { ok: false, error: idErr };
  const s3 = getR2Client();
  if (!s3) return r2Unconfigured();
  const bucket = env('CF_R2_BUCKET');
  const prefix = appPrefix(appId);

  const out: CfStoredFile[] = [];
  let token: string | undefined;
  try {
    do {
      const page = await withTimeout('r2:list', (signal) =>
        s3.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
          { abortSignal: signal },
        ),
      );
      for (const obj of page.Contents ?? []) {
        if (!obj.Key) continue;
        out.push({
          key: obj.Key,
          path: obj.Key.slice(prefix.length),
          size: obj.Size ?? 0,
          ...(obj.ETag ? { etag: obj.ETag.replaceAll('"', '') } : {}),
        });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  } catch (err) {
    return { ok: false, error: toCfError('r2:list', err) };
  }
  return ok(out);
}

/**
 * Every app id that has files in R2 — the orphan sweep's left-hand side
 * (Phase 2 · U2.5, ABUSE_RESPONSE §8.3 gap 3).
 *
 * Deleting a project cascades its `ops_apps` row away but does NOT touch the
 * hosted content, so the registry cannot be asked "what is still out there". Only
 * the bucket knows. This lists by delimiter, so it returns app ids rather than
 * every object — an account with a hundred apps and a hundred thousand files
 * answers in one page per hundred prefixes, not per hundred thousand keys.
 */
export async function listAppPrefixes(): Promise<CfResult<string[]>> {
  const s3 = getR2Client();
  if (!s3) return r2Unconfigured();
  const bucket = env('CF_R2_BUCKET');

  const ids: string[] = [];
  let token: string | undefined;
  try {
    do {
      const page = await withTimeout('r2:list-prefixes', (signal) =>
        s3.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: 'apps/', Delimiter: '/', ContinuationToken: token }),
          { abortSignal: signal },
        ),
      );
      for (const p of page.CommonPrefixes ?? []) {
        const prefix = p.Prefix ?? '';
        const id = prefix.slice('apps/'.length).replace(/\/$/, '');
        if (id) ids.push(id);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  } catch (err) {
    return { ok: false, error: toCfError('r2:list-prefixes', err) };
  }
  return ok(ids);
}

/** Read one file back, as bytes. Used for byte-match verification. */
export async function getAppFile(appId: string, path: string): Promise<CfResult<CfFetchedFile | null>> {
  const idErr = badAppId(appId);
  if (idErr) return { ok: false, error: idErr };
  const pathErr = badFilePath(path);
  if (pathErr) return { ok: false, error: pathErr };
  const s3 = getR2Client();
  if (!s3) return r2Unconfigured();

  try {
    const res = await withTimeout(`r2:get ${path}`, (signal) =>
      s3.send(
        new GetObjectCommand({ Bucket: env('CF_R2_BUCKET'), Key: `${appPrefix(appId)}${path}` }),
        { abortSignal: signal },
      ),
    );
    const bytes = res.Body ? await res.Body.transformToByteArray() : new Uint8Array();
    return ok({ path, bytes, ...(res.ContentType ? { contentType: res.ContentType } : {}) });
  } catch (err) {
    const e = toCfError(`r2:get ${path}`, err);
    // Absence is an answer, not an error — the caller asked whether it is there.
    if (e.code === 'not_found' || (err as { name?: string })?.name === 'NoSuchKey') return ok(null);
    return { ok: false, error: e };
  }
}

/**
 * Delete everything stored for an app, BATCHED.
 *
 * The #18 anti-pattern (deleteProject passing every key in one DeleteObjects call,
 * so any project over 1000 objects rejected or silently dropped the tail) is not
 * repeated: list paginates, deletes are chunked at DELETE_BATCH_SIZE, and the
 * result reports the batch count so the batching is observable in evidence rather
 * than merely asserted here.
 */
export async function deleteAppFiles(appId: string): Promise<CfResult<CfDeleteResult>> {
  const listed = await listAppFiles(appId);
  if (!listed.ok) return { ok: false, error: listed.error };
  if (listed.value.length === 0) return ok({ deleted: 0, batches: 0 });

  const s3 = getR2Client();
  if (!s3) return r2Unconfigured();
  const bucket = env('CF_R2_BUCKET');
  const keys = listed.value.map((f) => ({ Key: f.key }));

  let batches = 0;
  try {
    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      const chunk = keys.slice(i, i + DELETE_BATCH_SIZE);
      await withTimeout('r2:delete-objects', (signal) =>
        s3.send(
          new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: chunk, Quiet: true } }),
          { abortSignal: signal },
        ),
      );
      batches += 1;
    }
  } catch (err) {
    const e = toCfError('r2:delete-objects', err);
    logger.warn({ appId, batches, reason: e.code }, 'cf_delete_app_files_failed');
    return { ok: false, error: { ...e, message: `${e.message} (after ${batches} batch(es))` } };
  }
  logger.info({ appId, deleted: keys.length, batches }, 'cf_delete_app_files');
  return ok({ deleted: keys.length, batches });
}

// ── Cloudflare REST helper ──────────────────────────────────────────────────

interface CfApiEnvelope<T> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
}

/**
 * One request to the Cloudflare REST API, timed out and typed. `raw: true` returns
 * the response body as text (KV values and Worker scripts are not JSON envelopes).
 */
async function cfFetch<T>(
  label: string,
  path: string,
  init: { method: string; body?: BodyInit; headers?: Record<string, string> },
  opts: { raw?: boolean; notFoundIsNull?: boolean } = {},
): Promise<CfResult<T | null>> {
  const missing = missingFor('workers');
  if (missing.length > 0) return fail('not_configured', `Cloudflare API not configured — missing: ${missing.join(', ')}`);

  let res: Response;
  try {
    res = await withTimeout(label, (signal) =>
      fetch(`${CF_API_BASE}${path}`, {
        method: init.method,
        headers: { Authorization: `Bearer ${env('CF_API_TOKEN')}`, ...(init.headers ?? {}) },
        ...(init.body !== undefined ? { body: init.body } : {}),
        signal,
      }),
    );
  } catch (err) {
    return { ok: false, error: toCfError(label, err) };
  }

  if (res.status === 404 && opts.notFoundIsNull) return ok(null);

  const text = await res.text().catch(() => '');

  if (!res.ok) {
    // Prefer Cloudflare's own error text; it is the most useful thing we can give
    // the founder. Redacted, and length-capped so a giant HTML error page cannot
    // flood a log line or an evidence file.
    let detail = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as CfApiEnvelope<unknown>;
      const msgs = (parsed.errors ?? []).map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).filter(Boolean);
      if (msgs.length) detail = msgs.join('; ').slice(0, 500);
    } catch {
      /* not JSON — keep the truncated raw text */
    }
    const code: CfErrorCode =
      res.status === 401 || res.status === 403
        ? 'auth'
        : res.status === 404
          ? 'not_found'
          : res.status === 429
            ? 'rate_limited'
            : 'upstream';
    return fail(code, `${label}: ${detail || res.statusText}`, res.status);
  }

  if (opts.raw) return ok(text as unknown as T);

  try {
    const parsed = JSON.parse(text) as CfApiEnvelope<T>;
    if (!parsed.success) {
      const msgs = (parsed.errors ?? []).map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).filter(Boolean);
      return fail('upstream', `${label}: ${msgs.join('; ') || 'request unsuccessful'}`, res.status);
    }
    return ok((parsed.result ?? null) as T);
  } catch {
    return fail('upstream', `${label}: response was not valid JSON`, res.status);
  }
}

// ── KV routes ───────────────────────────────────────────────────────────────

function kvUnconfigured<T>(): CfResult<T> {
  return fail('not_configured', `KV not configured — missing: ${missingFor('kv').join(', ')}`);
}

function kvBase(): string {
  return `/accounts/${env('CF_ACCOUNT_ID')}/storage/kv/namespaces/${env('CF_KV_NAMESPACE_ID')}`;
}

/** Namespace reachability — the health probe's KV check. Returns the namespace title. */
export async function checkKvNamespace(): Promise<CfResult<{ title: string; latencyMs: number }>> {
  if (missingFor('kv').length > 0) return kvUnconfigured();
  const started = Date.now();
  const res = await cfFetch<{ title?: string; id?: string }>('kv:get-namespace', kvBase(), { method: 'GET' });
  if (!res.ok) return { ok: false, error: res.error };
  return ok({ title: res.value?.title ?? '', latencyMs: Date.now() - started });
}

/**
 * Point a hostname label at an app. Idempotent — a repeat write overwrites.
 *
 * The value is JSON; the Phase-2 router parses it. A bare-string value (an app id
 * with no envelope) is tolerated on READ for forward/backward safety, but never
 * written by this function.
 */
export async function setRoute(
  name: string,
  appId: string,
  opts: { status?: CfRouteStatus; dailyBudget?: number } = {},
): Promise<CfResult<CfRoute>> {
  if (!ROUTE_NAME_RE.test(name)) return fail('invalid_input', `invalid route name: ${JSON.stringify(name)}`);
  const idErr = badAppId(appId);
  if (idErr) return { ok: false, error: idErr };
  if (missingFor('kv').length > 0) return kvUnconfigured();

  const record: CfRoute = {
    name,
    appId,
    status: opts.status ?? 'active',
    ...(Number.isFinite(opts.dailyBudget) && (opts.dailyBudget as number) > 0
      ? { dailyBudget: Math.floor(opts.dailyBudget as number) }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  // Cloudflare's write-KV endpoint takes multipart/form-data with a `value` field
  // (and an optional `metadata` field). fetch sets the boundary itself — do not
  // set Content-Type here.
  const form = new FormData();
  form.append('value', JSON.stringify(record));
  form.append('metadata', JSON.stringify({ v: 1 }));

  const res = await cfFetch<unknown>(
    'kv:put-value',
    `${kvBase()}/values/${encodeURIComponent(routeKey(name))}`,
    { method: 'PUT', body: form },
  );
  if (!res.ok) return { ok: false, error: res.error };
  logger.info({ name, appId, status: record.status }, 'cf_set_route');
  return ok(record);
}

/** Read a route back. A missing key is `null` — an answer, not an error. */
export async function getRoute(name: string): Promise<CfResult<CfRoute | null>> {
  if (!ROUTE_NAME_RE.test(name)) return fail('invalid_input', `invalid route name: ${JSON.stringify(name)}`);
  if (missingFor('kv').length > 0) return kvUnconfigured();

  const res = await cfFetch<string>(
    'kv:get-value',
    `${kvBase()}/values/${encodeURIComponent(routeKey(name))}`,
    { method: 'GET' },
    { raw: true, notFoundIsNull: true },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (res.value === null || res.value === '') return ok(null);

  const raw = res.value as string;
  try {
    const parsed = JSON.parse(raw) as Partial<CfRoute>;
    if (!parsed || typeof parsed.appId !== 'string' || parsed.appId.length === 0) {
      return fail('upstream', `kv:get-value: route record for ${JSON.stringify(name)} has no appId`);
    }
    return ok({
      name,
      appId: parsed.appId,
      // Anything unrecognised reads as 'active' for backward safety, exactly as in
      // Phase 1 — but the ROUTER fails closed on an unknown status rather than
      // serving it. Tolerant here, strict where it can hurt someone.
      status: parsed.status === 'suspended' ? 'suspended' : parsed.status === 'released' ? 'released' : 'active',
      ...(Number.isFinite(parsed.dailyBudget) ? { dailyBudget: Number(parsed.dailyBudget) } : {}),
      ...(parsed.updatedAt ? { updatedAt: parsed.updatedAt } : {}),
    });
  } catch {
    // Tolerated legacy/simple shape: the value is the app id itself.
    return ok({ name, appId: raw.trim(), status: 'active' });
  }
}

/** Remove a route. Already-gone is success — deletion is idempotent by intent. */
export async function deleteRoute(name: string): Promise<CfResult<{ deleted: boolean }>> {
  if (!ROUTE_NAME_RE.test(name)) return fail('invalid_input', `invalid route name: ${JSON.stringify(name)}`);
  if (missingFor('kv').length > 0) return kvUnconfigured();

  // Deliberately NOT notFoundIsNull: a 404 must reach the error branch below so
  // "there was nothing to delete" is reported as deleted:false rather than being
  // silently indistinguishable from a real deletion.
  const res = await cfFetch<unknown>(
    'kv:delete-value',
    `${kvBase()}/values/${encodeURIComponent(routeKey(name))}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    if (res.error.code === 'not_found') return ok({ deleted: false });
    return { ok: false, error: res.error };
  }
  logger.info({ name }, 'cf_delete_route');
  return ok({ deleted: true });
}

// ── Workers ─────────────────────────────────────────────────────────────────

function workersBase(): string {
  return `/accounts/${env('CF_ACCOUNT_ID')}/workers/scripts`;
}

/**
 * Upload (create or overwrite) a Worker script as an ES module.
 *
 * On the lean plane this deploys exactly one script — the Phase-2 router. It is
 * built now so the token's Workers scope is proven in Phase 1 rather than
 * discovered missing in Phase 2, and so the paid/per-app tier needs no new
 * surface later.
 */
export async function deployWorker(
  scriptName: string,
  code: string,
  opts: { compatibilityDate?: string; bindings?: CfBinding[] } = {},
): Promise<CfResult<{ scriptName: string; bytes: number }>> {
  if (!SCRIPT_NAME_RE.test(scriptName)) {
    return fail('invalid_input', `invalid worker script name: ${JSON.stringify(scriptName)}`);
  }
  if (typeof code !== 'string' || code.trim().length === 0) {
    return fail('invalid_input', 'deployWorker called with empty code');
  }
  const missing = missingFor('workers');
  if (missing.length > 0) return fail('not_configured', `Workers API not configured — missing: ${missing.join(', ')}`);

  const entry = 'worker.mjs';
  const metadata = {
    main_module: entry,
    compatibility_date: opts.compatibilityDate ?? workerCompatDate(),
    // Bindings are declared on EVERY upload, not patched in afterwards: Cloudflare
    // replaces a script's binding set wholesale, so an upload that omitted them
    // would silently strip the router's access to KV and R2 and turn every app
    // into a 503. Sending them each time makes a deploy idempotent in fact, not
    // just in intent.
    ...(opts.bindings && opts.bindings.length > 0 ? { bindings: opts.bindings } : {}),
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append(entry, new Blob([code], { type: 'application/javascript+module' }), entry);

  const res = await cfFetch<unknown>('workers:upload', `${workersBase()}/${scriptName}`, {
    method: 'PUT',
    body: form,
  });
  if (!res.ok) return { ok: false, error: res.error };
  const bytes = Buffer.byteLength(code, 'utf8');
  logger.info({ scriptName, bytes }, 'cf_deploy_worker');
  return ok({ scriptName, bytes });
}

/** Read a Worker back. Absent → `null`, so "is it gone?" is answerable without a throw. */
export async function getWorker(scriptName: string): Promise<CfResult<CfWorker | null>> {
  if (!SCRIPT_NAME_RE.test(scriptName)) {
    return fail('invalid_input', `invalid worker script name: ${JSON.stringify(scriptName)}`);
  }
  const res = await cfFetch<string>(
    'workers:get',
    `${workersBase()}/${scriptName}`,
    { method: 'GET' },
    { raw: true, notFoundIsNull: true },
  );
  if (!res.ok) {
    if (res.error.code === 'not_found') return ok(null);
    return { ok: false, error: res.error };
  }
  if (res.value === null) return ok(null);
  return ok({ scriptName, size: Buffer.byteLength(res.value as string, 'utf8') });
}

/** Delete a Worker. Already-gone is success. */
export async function deleteWorker(scriptName: string): Promise<CfResult<{ deleted: boolean }>> {
  if (!SCRIPT_NAME_RE.test(scriptName)) {
    return fail('invalid_input', `invalid worker script name: ${JSON.stringify(scriptName)}`);
  }
  // Same as deleteRoute: a 404 goes to the error branch so already-gone reads as
  // deleted:false, not as a deletion that never happened.
  const res = await cfFetch<unknown>(
    'workers:delete',
    `${workersBase()}/${scriptName}?force=true`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    if (res.error.code === 'not_found') return ok({ deleted: false });
    return { ok: false, error: res.error };
  }
  logger.info({ scriptName }, 'cf_delete_worker');
  return ok({ deleted: true });
}

/**
 * List Worker scripts — the health probe's token-scope check. Returns the COUNT
 * only: script names are not secret, but they are not the probe's business either,
 * and a count is enough to prove the token carries Workers Scripts read.
 */
export async function listWorkers(): Promise<CfResult<{ count: number; latencyMs: number }>> {
  const started = Date.now();
  const res = await cfFetch<Array<{ id?: string }>>('workers:list', workersBase(), { method: 'GET' });
  if (!res.ok) return { ok: false, error: res.error };
  return ok({ count: Array.isArray(res.value) ? res.value.length : 0, latencyMs: Date.now() - started });
}

// ── Zone, DNS, Worker routes (Phase 2 · U2.2) ───────────────────────────────
//
// The three calls that make `{name}.justgoblin.app` resolve to the router at all.
// They need token scopes the Phase-1 calls did not: Zone:Read, DNS:Edit and
// Workers Routes:Edit. Each is written so a MISSING SCOPE is reported as a typed
// `auth` error rather than a crash, because the founder's next action differs
// completely between "the token cannot do this" (add the scope in the dashboard)
// and "Cloudflare said no" (read the message).
//
// All three are IDEMPOTENT: they look before they write, and re-running a
// provision that already succeeded changes nothing and reports what it found.

/** Find the zone id for a domain. The founder never has to paste one anywhere. */
export async function findZoneId(domain: string): Promise<CfResult<string | null>> {
  const name = domain.trim().toLowerCase();
  if (!name) return fail('invalid_input', 'findZoneId called with an empty domain');
  const res = await cfFetch<Array<{ id?: string; name?: string }>>(
    'zones:list',
    `/zones?name=${encodeURIComponent(name)}`,
    { method: 'GET' },
  );
  if (!res.ok) return { ok: false, error: res.error };
  const zone = (res.value ?? []).find((z) => (z.name ?? '').toLowerCase() === name);
  // Absent is an answer: the domain is not on this Cloudflare account (yet).
  return ok(zone?.id ?? null);
}

/** The DNS records matching a name on a zone. */
export async function listDnsRecords(zoneId: string, name: string): Promise<CfResult<CfDnsRecord[]>> {
  const res = await cfFetch<Array<{ id?: string; name?: string; type?: string; proxied?: boolean }>>(
    'dns:list',
    `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(name)}`,
    { method: 'GET' },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return ok(
    (res.value ?? [])
      .filter((r) => r.id && r.name)
      .map((r) => ({ id: r.id!, name: r.name!, type: r.type ?? '', proxied: Boolean(r.proxied) })),
  );
}

/**
 * Make sure `*.{domain}` exists as a PROXIED record, creating it if it does not.
 *
 * Why an A record to 192.0.2.1: a Workers route only fires for hostnames that
 * resolve through Cloudflare's proxy, so a record must exist — but no origin
 * server does, because the router IS the origin. 192.0.2.1 is the RFC 5737
 * documentation address, reserved precisely so it can never route anywhere real.
 * If the Worker route is ever removed, the wildcard fails closed (nothing answers)
 * instead of leaking traffic to a stranger's server.
 */
export async function ensureWildcardDns(
  zoneId: string,
  domain: string,
): Promise<CfResult<{ created: boolean; recordId: string; proxied: boolean }>> {
  const name = `*.${domain.trim().toLowerCase()}`;
  const existing = await listDnsRecords(zoneId, name);
  if (!existing.ok) return { ok: false, error: existing.error };

  const match = existing.value.find((r) => r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME');
  if (match) {
    // Present but unproxied is worse than absent: it looks configured and the
    // Worker never runs. Report it truthfully instead of overwriting the
    // founder's record behind their back.
    return ok({ created: false, recordId: match.id, proxied: match.proxied });
  }

  const res = await cfFetch<{ id?: string; proxied?: boolean }>(
    'dns:create',
    `/zones/${encodeURIComponent(zoneId)}/dns_records`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'A',
        name,
        content: '192.0.2.1',
        proxied: true,
        ttl: 1,
        comment: 'Goblin Living Apps — wildcard for the router Worker (AKT 2 Phase 2)',
      }),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  logger.info({ name }, 'cf_wildcard_dns_created');
  return ok({ created: true, recordId: res.value?.id ?? '', proxied: Boolean(res.value?.proxied ?? true) });
}

/** Every Workers route on a zone. */
export async function listWorkerRoutes(zoneId: string): Promise<CfResult<CfWorkerRoute[]>> {
  const res = await cfFetch<Array<{ id?: string; pattern?: string; script?: string }>>(
    'routes:list',
    `/zones/${encodeURIComponent(zoneId)}/workers/routes`,
    { method: 'GET' },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return ok(
    (res.value ?? [])
      .filter((r) => r.id && r.pattern)
      .map((r) => ({ id: r.id!, pattern: r.pattern!, script: r.script ?? '' })),
  );
}

/**
 * Bind a URL pattern on a zone to a Worker script, creating or correcting it.
 *
 * Correcting matters: a pattern already pointing at a DIFFERENT script is not a
 * success, and silently leaving it would mean the founder reads "provisioned" while
 * the wrong code serves every app. It is updated in place and reported as `updated`.
 */
export async function ensureWorkerRoute(
  zoneId: string,
  pattern: string,
  scriptName: string,
): Promise<CfResult<{ created: boolean; updated: boolean; routeId: string }>> {
  if (!SCRIPT_NAME_RE.test(scriptName)) {
    return fail('invalid_input', `invalid worker script name: ${JSON.stringify(scriptName)}`);
  }
  const existing = await listWorkerRoutes(zoneId);
  if (!existing.ok) return { ok: false, error: existing.error };

  const match = existing.value.find((r) => r.pattern === pattern);
  if (match && match.script === scriptName) return ok({ created: false, updated: false, routeId: match.id });

  if (match) {
    const res = await cfFetch<{ id?: string }>(
      'routes:update',
      `/zones/${encodeURIComponent(zoneId)}/workers/routes/${encodeURIComponent(match.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, script: scriptName }),
      },
    );
    if (!res.ok) return { ok: false, error: res.error };
    logger.warn({ pattern, from: match.script, to: scriptName }, 'cf_worker_route_repointed');
    return ok({ created: false, updated: true, routeId: res.value?.id ?? match.id });
  }

  const res = await cfFetch<{ id?: string }>(
    'routes:create',
    `/zones/${encodeURIComponent(zoneId)}/workers/routes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, script: scriptName }),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  logger.info({ pattern, scriptName }, 'cf_worker_route_created');
  return ok({ created: true, updated: false, routeId: res.value?.id ?? '' });
}

/** The apps domain (`justgoblin.app`). Phase 2 builds `{name}.{domain}` from it. */
export function opsAppsDomain(): string {
  return env('OPS_APPS_DOMAIN');
}

/**
 * The marketing site the apps domain redirects to, and the base of the AUP link on
 * the suspended page.
 *
 * Deliberately NOT added to CF_ENV_VARS: that list drives the health probe's
 * "every required variable present" check, and a new required name would turn a
 * green Phase-1 health report degraded the moment this merges — a false alarm
 * about a value that has a correct default.
 */
export function opsSiteUrl(): string {
  const raw = unwrapEnv(process.env.OPS_SITE_URL);
  return (raw || 'https://justgoblin.com').replace(/\/$/, '');
}
