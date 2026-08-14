/**
 * AKT 2 · PHASE 4 · U4.3 — Turnstile verification.
 *
 * ── P4-e, DECIDED: the API verifies, not the router ──────────────────────────
 * The preflight left this open and warned that it decides where the secret lives.
 * It is settled here, and the argument is not a preference:
 *
 *   1. The ingest endpoint has to write to the app's OWN database. On the lean
 *      plane one shared router Worker serves the whole fleet, and Worker bindings
 *      are STATIC per deploy — binding every app's database to the router would
 *      mean re-uploading the router each time one builder presses publish.
 *   2. The only way round that from the edge is for the router to call D1's REST
 *      API itself, which means shipping CF_API_TOKEN into a script that runs on
 *      every visitor request. cf-deploy.ts's header rules that out, and it is
 *      right to: that token can delete every app on the account.
 *   3. So the write happens in the platform API. Verifying somewhere the write does
 *      not happen would buy nothing — a token verified at the edge and then trusted
 *      by the API is a header anybody can send.
 *
 * Therefore: `CF_TURNSTILE_SECRET_KEY` lives in the Railway API environment and
 * nowhere else. It is in `SECRET_ENV_VARS` (cf-deploy.ts), so the redaction that
 * already exists strips it from every outbound string. `routerBindings()` gains
 * nothing, and the router keeps its single responsibility and its 405 guard.
 *
 * The SITE key (`CF_TURNSTILE_SITE_KEY`) is public and goes the other way: it is
 * baked into the generated app's HTML at publish time (U4.7). It is deliberately
 * NOT a `NEXT_PUBLIC_*` variable — it never needs to reach the Next.js bundle,
 * because the form it belongs to is not a Goblin page.
 *
 * ── A MISSING SECRET REFUSES. It does not wave traffic through ───────────────
 * If `CF_TURNSTILE_SECRET_KEY` is unset at runtime, this returns `not_configured`
 * and the ingest endpoint refuses the submission. A spam door that looks closed is
 * worse than one that says it is open: the owner would believe their form was
 * protected while it accepted everything, and would find out from the flood.
 *
 * ── What is deliberately NOT sent to Cloudflare ──────────────────────────────
 * `remoteip` is an optional parameter of siteverify and it is not used. Not
 * because Cloudflare would learn anything new — it served the challenge, so it has
 * already seen the visitor — but because sending it would mean this code path
 * reads, holds and passes on a visitor's IP address, and the moment that value
 * exists in a variable it can end up in a log line. The cleanest guarantee that
 * an IP never leaks is that nothing here ever holds one.
 *
 * Cost: $0.00. Turnstile's free tier is unlimited challenges, 20 widgets, 10
 * hostnames per widget (OPS_SPIKE_0 §2.4, re-checked in the Phase-4 preflight §2).
 * Booked in docs/GOBLIN_CONSUMPTION_LEDGER.md → M-F2 as a zero-cost dependency,
 * because a dependency with no invoice is still a dependency.
 */

import { envString } from '../lib/env-value';
import logger from '../lib/logger';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Per-call timeout. The webhook lesson: an upstream that never answers must not hold a request open. */
const TURNSTILE_TIMEOUT_MS = 5_000;

export type TurnstileOutcome =
  /** Cloudflare says this is a real person on the expected hostname. */
  | { ok: true }
  /** Verified as NOT valid — a failed or replayed challenge. The visitor may retry. */
  | { ok: false; code: 'failed'; codes: string[] }
  /** No token in the request at all. Usually a bot; sometimes a broken page. */
  | { ok: false; code: 'missing_token'; codes: [] }
  /** We have no secret. NOT a pass — see the header. */
  | { ok: false; code: 'not_configured'; codes: [] }
  /** Cloudflare did not answer in time or answered nonsense. UNKNOWN, never green. */
  | { ok: false; code: 'unavailable'; codes: string[] };

export function turnstileConfigured(): boolean {
  return envString('CF_TURNSTILE_SECRET_KEY').length > 0;
}

/** The public site key, for injection into a generated app. Empty string when unset. */
export function turnstileSiteKey(): string {
  return envString('CF_TURNSTILE_SITE_KEY');
}

/**
 * Ask Cloudflare whether this token is good.
 *
 * `fetchImpl` is injectable so the tests can drive every branch — including the
 * timeout — without a network. It is the only seam; there is no "skip verification"
 * flag, and there must never be one.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileOutcome> {
  const secret = envString('CF_TURNSTILE_SECRET_KEY');
  if (!secret) {
    // Loud, because this is a configuration fault that silently disarms the only
    // spam layer the ingest path has.
    logger.error({}, 'ops_turnstile_not_configured — form submissions are being refused');
    return { ok: false, code: 'not_configured', codes: [] };
  }

  const response = (token ?? '').trim();
  if (!response) return { ok: false, code: 'missing_token', codes: [] };

  const body = new URLSearchParams({ secret, response });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'ops_turnstile_upstream_status');
      return { ok: false, code: 'unavailable', codes: [] };
    }
    const parsed = (await res.json()) as { success?: boolean; 'error-codes'?: unknown };
    const codes = Array.isArray(parsed['error-codes']) ? parsed['error-codes'].map(String) : [];
    if (parsed.success === true) return { ok: true };

    // Cloudflare's own diagnosis of OUR configuration is not the visitor's fault
    // and must not be reported as their failed challenge — the founder needs to
    // see it, and the visitor needs a different sentence.
    if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
      logger.error({ codes }, 'ops_turnstile_secret_rejected — check CF_TURNSTILE_SECRET_KEY');
      return { ok: false, code: 'not_configured', codes: [] };
    }
    return { ok: false, code: 'failed', codes };
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    logger.warn({ aborted }, 'ops_turnstile_unreachable');
    // UNKNOWN. The caller decides what to do with it, and it decides to refuse —
    // "we could not check" is not "you are a person", and an ingest that fails
    // OPEN under load is an ingest a flood can switch off.
    return { ok: false, code: 'unavailable', codes: [] };
  } finally {
    clearTimeout(timer);
  }
}
