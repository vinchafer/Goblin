/**
 * AKT 2 · PHASE 4 — "is this instance set up to accept form submissions?", as a
 * report a human can act on.
 *
 * ── Why this is its own module ───────────────────────────────────────────────
 * Two surfaces need the same answer and must not compute it twice:
 * `GET /api/ops/health` (the builder-gated probe, for a machine or a curl) and
 * `GET /api/ops-console/status` (the founder console, which is the only one
 * reachable from a phone). Two implementations of "is it configured" is how one of
 * them ends up saying yes while the other says no.
 *
 * ── What it will never contain ───────────────────────────────────────────────
 * A value, a prefix, a length, or a hostname. `present` is booleans BY NAME. The
 * endpoint is described by its SHAPE — which variable answered, the scheme,
 * whether it is a bare origin, whether a trailing slash had to be removed.
 * `readFormsEndpoint()` keeps the origin behind an explicitly-named field that
 * nothing here reads, so a later edit has to mean it.
 *
 * ── The four verdicts, and why `incomplete` is its own word ─────────────────
 *   ready          — all three present, endpoint a usable origin. Forms will work.
 *   not_configured — nothing form-related is set. A CORRECT state, not a fault:
 *                    an API instance with no forms is a supported instance, which
 *                    is the whole reason CF_TURNSTILE_* were kept out of
 *                    CF_ENV_VARS (cf-deploy.ts).
 *   incomplete     — SOME of it is set. The dangerous middle: it looks configured,
 *                    and a form publish will refuse. If this collapsed into
 *                    `not_configured`, half-done would read as off.
 *   malformed      — the endpoint is set and is not a bare origin. The publish
 *                    refuses rather than shipping a form that posts into nothing.
 *
 * It says nothing about whether `CF_API_TOKEN` carries D1:Edit. A token's scopes
 * cannot be read back from the token, so that one surfaces at the first form
 * publish — honestly, as `d1_unavailable`. The `note` field says so out loud
 * rather than letting a green-looking report imply otherwise.
 */

import { envString } from '../lib/env-value';
import { readFormsEndpoint } from './ops-form-wiring';

export type FormsConfigVerdict = 'ready' | 'not_configured' | 'incomplete' | 'malformed';

export interface FormsConfigReport {
  verdict: FormsConfigVerdict;
  /** Booleans by name. Never a value, never a length, never a prefix. */
  present: {
    OPS_FORMS_ENDPOINT: boolean;
    NEXT_PUBLIC_API_URL: boolean;
    CF_TURNSTILE_SITE_KEY: boolean;
    CF_TURNSTILE_SECRET_KEY: boolean;
  };
  /** Shape only — no host, no path, no value. */
  endpoint:
    | { source: string; scheme: 'https' | 'http'; bareOrigin: true; trailingSlashRemoved: boolean }
    | { source: string; bareOrigin: false; problem: string };
  /** Which names still have to be set for forms to work at all. */
  missing: string[];
  note: string;
}

export function formsConfigReport(): FormsConfigReport {
  const present = {
    OPS_FORMS_ENDPOINT: envString('OPS_FORMS_ENDPOINT').length > 0,
    // The documented fallback, so it is part of the answer rather than a surprise.
    NEXT_PUBLIC_API_URL: envString('NEXT_PUBLIC_API_URL').length > 0,
    CF_TURNSTILE_SITE_KEY: envString('CF_TURNSTILE_SITE_KEY').length > 0,
    CF_TURNSTILE_SECRET_KEY: envString('CF_TURNSTILE_SECRET_KEY').length > 0,
  };

  const read = readFormsEndpoint();
  const endpoint: FormsConfigReport['endpoint'] = read.ok
    ? {
        source: read.source,
        scheme: read.scheme,
        bareOrigin: true,
        trailingSlashRemoved: read.normalizedTrailingSlash,
      }
    : { source: read.source, bareOrigin: false, problem: read.problem };

  const anySet = Object.values(present).some(Boolean);
  const allSet = present.CF_TURNSTILE_SITE_KEY && present.CF_TURNSTILE_SECRET_KEY && read.ok;

  const verdict: FormsConfigVerdict = !anySet
    ? 'not_configured'
    : !read.ok && read.problem !== 'unset'
      ? 'malformed'
      : allSet
        ? 'ready'
        : 'incomplete';

  return {
    verdict,
    present,
    endpoint,
    missing: [
      ...(present.CF_TURNSTILE_SITE_KEY ? [] : ['CF_TURNSTILE_SITE_KEY']),
      ...(present.CF_TURNSTILE_SECRET_KEY ? [] : ['CF_TURNSTILE_SECRET_KEY']),
      ...(read.ok ? [] : ['OPS_FORMS_ENDPOINT']),
    ],
    note:
      'Presence by name and shape only — no values. Does not affect `status`. '
      + 'Says nothing about whether CF_API_TOKEN carries D1:Edit; that surfaces at the first form publish.',
  };
}
