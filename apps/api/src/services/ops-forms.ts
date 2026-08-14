/**
 * AKT 2 · PHASE 4 · U4.3 + U4.6 — the ingest decision.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THIS IS ACT 2's FIRST PUBLIC, UNAUTHENTICATED WRITE.
 *
 * Everything else in Act 2 is behind `isOpsBetaAccount` or the founder gate, or is
 * read-only. This path accepts input from anybody on the internet and stores it.
 * The preflight named that (§7.2) and it is the reason the layers below are layers
 * and not one check.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── The order, and why it is this order ──────────────────────────────────────
 *   1. kill switch      — one lever that stops the whole fleet accepting data
 *   2. the app          — a registry row, active, with a database. No row → the
 *                         same honest "there is nothing here" Act 2 already gives
 *   3. the origin       — the request must come from the app's OWN hostname
 *   4. shape and size   — cheap, local, before anything external is asked
 *   5. rate limit       — before Turnstile, so a flood cannot cost us N siteverify
 *                         calls per second
 *   6. TURNSTILE        — the actual spam layer
 *   7. the monthly cap  — after the visitor is established as a person, so a
 *                         genuine visitor is the one who gets told the box is full
 *   8. the insert       — and only a confirmed insert is ever reported as accepted
 *
 * ── P4-b, DECIDED: over the cap, the submission is REFUSED ───────────────────
 * Refused with an honest message to the visitor AND a notification to the owner.
 * Never accepted-and-discarded. The alternative — take it, drop it, show a
 * thank-you — is the single worst thing this file could do: the visitor believes
 * they have been in touch, the owner never learns they were, and neither of them
 * finds out. A refusal is a smaller harm than a lie, and it is the only one of the
 * two that anybody can act on.
 *
 * This is the first Goblin mechanism that turns away a real END USER rather than a
 * builder, which is why the sentence they get says what happened, says it is not
 * their fault, and does not invent a time when it will work again.
 *
 * ── What a refused visitor is never told ─────────────────────────────────────
 * Nothing about the internals. Not "D1 returned 500", not a rule id, not whether
 * the app exists but is suspended versus does not exist at all. The messages below
 * are the whole vocabulary, and each is a true sentence in the app's language.
 *
 * ── NO SUBMISSION CONTENT LEAVES THIS FILE except into that app's database ───
 * Not into a log line, not into an error, not into a model call. There is no
 * classifier on this path and Phase 3's scan does not cover it — the scan reads the
 * ARTIFACT at publish time, and what a stranger types afterwards is read by nothing.
 * That is stated in the phase report as a limitation rather than papered over.
 */

import { createHash, randomBytes } from 'node:crypto';
import { envString } from '../lib/env-value';
import { findOpsAppByName, type OpsApp } from './ops-apps-store';
import { monthlySubmissionBudget } from './ops-caps';
import { acceptedThisMonth, countRefusal, insertSubmission, usageMonth } from './ops-d1';
import { verifyTurnstile } from './ops-turnstile';
import { opsAppsDomain } from './cf-deploy';
import logger from '../lib/logger';

// ── limits (local, cheap, checked before anything external) ─────────────────

/** The whole request body. A form is text; 16 KB is a generous essay. */
export const MAX_BODY_BYTES = 16 * 1024;
/** Fields per submission. */
export const MAX_FIELDS = 25;
/** A field NAME. Longer than this is not a label, it is an attack surface. */
export const MAX_FIELD_NAME_CHARS = 64;
/** A field VALUE. 5.000 characters is about two pages of typed text. */
export const MAX_FIELD_VALUE_CHARS = 5_000;
/** A form id, as it appears in the URL. */
const FORM_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * The per-source rate limit.
 *
 * ── Honest about what this is ────────────────────────────────────────────────
 * IN-PROCESS. Railway can run more than one instance, and each holds its own
 * window, so the effective ceiling is (instances × limit). It is a brake on a
 * single loop from a single source, not a distributed rate limiter, and Turnstile
 * is the layer that actually costs a spammer something. Said here rather than
 * discovered from a graph.
 *
 * It is independent of the app's REQUEST budget by construction: that one is
 * enforced at the router out of the KV record and counts page views. A form flood
 * would exhaust an app's daily serving allowance and take the app OFFLINE for its
 * real visitors — which is exactly what U4.3 means by "rate-limited independently".
 */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_SOURCE = 5;
const RATE_MAX_PER_APP = 60;

/**
 * A per-process salt, generated at import and never persisted.
 *
 * The rate limiter needs to tell two sources apart. It does NOT need to know who
 * they are, and this codebase has decided not to hold visitor IPs (see ops-d1.ts).
 * So the address is hashed with a salt that dies with the process: within one
 * process two requests from one source collide, which is all the limiter needs;
 * across processes and across restarts the keys are unrelated, so nothing here can
 * be correlated into a history of anybody. The raw address exists only as an
 * argument to `sourceKey` and is never returned, stored or logged.
 */
const RATE_SALT = randomBytes(16).toString('hex');

const rateBuckets = new Map<string, number[]>();

/** Hash a source identifier into an opaque, process-local key. The input never escapes. */
export function sourceKey(appId: string, rawSource: string): string {
  return createHash('sha256').update(`${RATE_SALT}:${appId}:${rawSource}`).digest('hex').slice(0, 32);
}

function rateAllows(key: string, limit: number, now: number): boolean {
  const seen = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (seen.length >= limit) {
    rateBuckets.set(key, seen);
    return false;
  }
  seen.push(now);
  rateBuckets.set(key, seen);
  // Cheap ceiling on the map itself, so a wide spray of sources cannot grow it
  // without bound. Dropping the oldest bucket only forgives a limit, never enforces
  // one that was not earned.
  if (rateBuckets.size > 20_000) {
    const oldest = rateBuckets.keys().next().value;
    if (oldest) rateBuckets.delete(oldest);
  }
  return true;
}

/** Test seam — the window is process-global by design, and a test must be able to clear it. */
export function __resetRateLimiterForTest(): void {
  rateBuckets.clear();
}

// ── the kill switch ─────────────────────────────────────────────────────────

/**
 * One lever that stops the WHOLE fleet accepting submissions.
 *
 * Deliberately NOT `OPS_HOSTING_ENABLED`. That flag governs who may PUBLISH; the
 * operator powers already refuse to be gated by it (ops-operator.ts header) for the
 * same reason this one is separate: turning the builder surface dark must not
 * silently break the forms of apps that are already live and already promising
 * their visitors that somebody will read this.
 *
 * DEFAULTS TO ON. An unset variable means "forms work", because the only apps this
 * can affect are ones that were published with a form after this phase shipped —
 * there is nothing to protect a pre-existing cohort from, and a default-off switch
 * would mean every form is broken until somebody notices a variable is missing.
 * Set it to `false` to close the door; anything else is on.
 */
export function formsEnabled(): boolean {
  return envString('OPS_FORMS_ENABLED').toLowerCase() !== 'false';
}

// ── the outcome ─────────────────────────────────────────────────────────────

export type IngestRefusalCode =
  | 'forms_disabled'
  | 'unknown_form'
  | 'bad_origin'
  | 'bad_shape'
  | 'too_large'
  | 'rate_limited'
  | 'challenge_failed'
  | 'challenge_unavailable'
  | 'not_configured'
  | 'over_cap'
  | 'cap_unknown'
  | 'storage_failed';

export interface IngestAccepted {
  ok: true;
  submissionId: string;
  app: OpsApp;
  formId: string;
  fields: Record<string, string>;
  /** Where the month stands AFTER this one, when it could be established. */
  acceptedThisMonth: number | null;
  monthlyCap: number;
}

export interface IngestRefused {
  ok: false;
  code: IngestRefusalCode;
  /** The HTTP status the route should answer with. */
  status: number;
  /**
   * The app whose form this was, when we got far enough to know. Present on
   * `over_cap` because the OWNER has to be told, and absent on `unknown_form`
   * because there is nobody to tell.
   */
  app?: OpsApp;
}

export type IngestResult = IngestAccepted | IngestRefused;

export interface IngestInput {
  /** The hostname label from the URL — `{appName}.justgoblin.app`. */
  appName: string;
  formId: string;
  /** The `Origin` header, verbatim. */
  origin: string | null;
  /** The Turnstile response token from the body. */
  token: string | null;
  /** The already-parsed body fields. */
  fields: Record<string, unknown>;
  /** How many bytes the body was — measured by the route, before parsing. */
  bodyBytes: number;
  /**
   * Something that identifies the SOURCE of the request for rate limiting. The
   * caller hashes it before it gets here (`sourceKey`), so this module never sees
   * an address.
   */
  rateKey: string;
  now?: number;
}

export interface IngestDeps {
  findApp: typeof findOpsAppByName;
  verify: typeof verifyTurnstile;
  accepted: typeof acceptedThisMonth;
  insert: typeof insertSubmission;
  refuse: typeof countRefusal;
  appsDomain: () => string;
}

export const defaultIngestDeps: IngestDeps = {
  findApp: findOpsAppByName,
  verify: verifyTurnstile,
  accepted: acceptedThisMonth,
  insert: insertSubmission,
  refuse: countRefusal,
  appsDomain: opsAppsDomain,
};

const refused = (code: IngestRefusalCode, status: number, app?: OpsApp): IngestRefused => ({
  ok: false,
  code,
  status,
  ...(app ? { app } : {}),
});

/**
 * Normalise a raw body into the flat string map v1 of the shape stores.
 *
 * Rejects rather than repairs. A body that is the wrong shape is a bug in whatever
 * sent it or an attempt at something, and quietly coercing it would mean storing
 * something nobody typed. The Turnstile token is stripped here so it can never
 * become a stored field.
 */
export function normalizeFields(
  raw: Record<string, unknown>,
): { ok: true; fields: Record<string, string> } | { ok: false; why: 'bad_shape' | 'too_large' } {
  const out: Record<string, string> = {};
  let count = 0;

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'cf-turnstile-response' || key === '_goblin_token') continue;
    const name = key.trim();
    if (!name || name.length > MAX_FIELD_NAME_CHARS) return { ok: false, why: 'bad_shape' };
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') return { ok: false, why: 'bad_shape' };
    const text = String(value);
    if (text.length > MAX_FIELD_VALUE_CHARS) return { ok: false, why: 'too_large' };
    count += 1;
    if (count > MAX_FIELDS) return { ok: false, why: 'too_large' };
    out[name] = text;
  }

  // An empty submission is a shape problem, not an empty inbox item: somebody
  // would be told "thank you" for nothing having arrived.
  if (count === 0) return { ok: false, why: 'bad_shape' };
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > MAX_BODY_BYTES) return { ok: false, why: 'too_large' };
  return { ok: true, fields: out };
}

/**
 * The whole decision, from a parsed request to a stored row or an honest refusal.
 *
 * Deliberately free of HTTP: the route below turns an `IngestResult` into a status
 * and a sentence. Keeping the decision here is what makes every branch testable
 * without a server, and it is why the refusal codes are a closed union.
 */
export async function ingestSubmission(
  input: IngestInput,
  deps: IngestDeps = defaultIngestDeps,
): Promise<IngestResult> {
  const now = input.now ?? Date.now();

  // 1. The fleet-wide lever.
  if (!formsEnabled()) return refused('forms_disabled', 503);

  // 2. The app. Shape first — an appName that cannot be a hostname label never
  //    reaches the database.
  const appName = input.appName.trim().toLowerCase();
  if (!FORM_ID_RE.test(input.formId)) return refused('bad_shape', 400);
  const app = await deps.findApp(appName);

  // Every "there is nothing here" answer is the SAME answer. A suspended app must
  // not be distinguishable from a non-existent one at this endpoint: the visitor
  // has no use for the difference and an abuser would.
  if (!app || app.status !== 'active' || !app.d1DatabaseId) {
    return refused('unknown_form', 404);
  }

  // 3. The origin. This endpoint exists for the snippet Goblin injects into the
  //    app's own page, and that page is served from exactly one hostname.
  const expected = `https://${app.appName}.${deps.appsDomain()}`;
  if (!input.origin || input.origin.toLowerCase() !== expected.toLowerCase()) {
    return refused('bad_origin', 403, app);
  }

  // 4. Shape and size, locally.
  if (input.bodyBytes > MAX_BODY_BYTES) return refused('too_large', 413, app);
  const normalized = normalizeFields(input.fields);
  if (!normalized.ok) {
    return refused(normalized.why === 'too_large' ? 'too_large' : 'bad_shape', normalized.why === 'too_large' ? 413 : 400, app);
  }

  // 5. Rate limit, BEFORE Turnstile — a flood must not cost one siteverify call
  //    per request. Two windows: one per source, one for the whole app.
  if (!rateAllows(input.rateKey, RATE_MAX_PER_SOURCE, now)) {
    logger.warn({ appId: app.appId }, 'ops_form_rate_limited_source');
    return refused('rate_limited', 429, app);
  }
  if (!rateAllows(`app:${app.appId}`, RATE_MAX_PER_APP, now)) {
    logger.warn({ appId: app.appId }, 'ops_form_rate_limited_app');
    return refused('rate_limited', 429, app);
  }

  // 6. Turnstile.
  const challenge = await deps.verify(input.token);
  if (!challenge.ok) {
    if (challenge.code === 'not_configured') return refused('not_configured', 503, app);
    if (challenge.code === 'unavailable') return refused('challenge_unavailable', 503, app);
    return refused('challenge_failed', 403, app);
  }

  // 7. The monthly cap (U4.6). After the challenge, so the person who gets told the
  //    box is full is a person.
  const cap = monthlySubmissionBudget(app.capsProfile);
  const month = usageMonth(now);
  const used = await deps.accepted(app.d1DatabaseId, month);
  if (used === null) {
    // We could not count. Accepting anyway would mean the cap silently stops
    // existing under exactly the conditions where it matters, and the honest thing
    // to tell the visitor is that we could not take it right now — not a thank-you
    // for something we cannot account for.
    logger.warn({ appId: app.appId }, 'ops_form_cap_unknown');
    return refused('cap_unknown', 503, app);
  }
  if (used >= cap) {
    await deps.refuse(app.d1DatabaseId, month);
    logger.warn({ appId: app.appId, used, cap }, 'ops_form_over_cap');
    return refused('over_cap', 429, app);
  }

  // 8. Store it. Only a CONFIRMED insert is ever reported as accepted.
  const stored = await deps.insert(app.d1DatabaseId, { formId: input.formId, fields: normalized.fields, now });
  if (!stored.ok || !stored.id) {
    logger.error({ appId: app.appId, fieldCount: Object.keys(normalized.fields).length }, 'ops_form_storage_failed');
    return refused('storage_failed', 503, app);
  }

  logger.info({ appId: app.appId, formId: input.formId, used: used + 1, cap }, 'ops_form_submission_stored');
  return {
    ok: true,
    submissionId: stored.id,
    app,
    formId: input.formId,
    fields: normalized.fields,
    acceptedThisMonth: used + 1,
    monthlyCap: cap,
  };
}
