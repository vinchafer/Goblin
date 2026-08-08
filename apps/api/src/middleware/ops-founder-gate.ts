/**
 * AKT 2 · PHASE 2.5 · U-C1 — the founder allowlist as HTTP middleware.
 *
 * This is `isOpsFounderAccount()` (services/ops-founder.ts) applied at the edge of
 * every console-backing route. It resolves the caller's ordinary Supabase bearer
 * token — the one the logged-in browser already has — into an email, and admits
 * only the operator. No admin key, no hand-copied token, no terminal.
 *
 * ── Why 404, byte-identical, and not 401/403 ─────────────────────────────────
 * Same reasoning as middleware/ops-gate.ts, and the same bytes. A 403 would tell a
 * curious Act-1 user that a founder console exists and that they are excluded from
 * it; a 401 would invite them to go find a credential. Every refusal path here —
 * allowlist unset, no bearer, malformed bearer, invalid token, valid token that is
 * not the founder's, Supabase unreachable — returns Hono's built-in notFound
 * response verbatim: status 404, `text/plain; charset=UTF-8`, body `404 Not Found`.
 * Nothing can be inferred by comparing two refusals against each other, and
 * nothing distinguishes this mount from a path that was never routed.
 *
 * ── Why it does NOT also require opsGate ─────────────────────────────────────
 * Deliberate, and it is the whole point of the split (see services/ops-founder.ts).
 * `opsGate` ANDs in `OPS_HOSTING_ENABLED`, which is how Act 2 goes dark. But going
 * dark does not stop a live hosted app — the router serves from KV and R2 and never
 * asks the API anything — so the operator surface must keep working with the kill
 * switch off, or flipping the switch mid-incident would disarm the only stop.
 * Concretely: the console's status card can therefore REPORT "hosting: aus" instead
 * of the founder meeting a 404 and having to guess why.
 *
 * This is not a hole in the cohort boundary. `OPS_FOUNDER_ACCOUNTS` is its own
 * allowlist, unset by default, and an Act-1 user who is not on it sees exactly the
 * 404 they see today.
 *
 * ── Fail CLOSED on infrastructure trouble ────────────────────────────────────
 * Supabase unreachable → 404, never "admit and sort it out later". An operator
 * surface that opens when auth is down is worse than one that is briefly
 * unavailable to its one account.
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import { isOpsFounderAccount, opsFounderConfigured } from '../services/ops-founder';
import { envFlag } from '../lib/env-value';
import logger from '../lib/logger';

/**
 * The single refusal. Byte-identical to Hono's built-in notFound response and to
 * middleware/ops-gate.ts's, so a console route refuses exactly as a non-existent
 * route does.
 *
 * `reason` is attached as a header ONLY under the debug window described below.
 * With `OPS_FOUNDER_DEBUG` unset — the default and the production state — this
 * function is byte-for-byte what it has always been: status, body and headers
 * indistinguishable from a path that was never routed.
 */
function notFound(c: Context, reason?: string) {
  if (reason) c.header(OPS_DEBUG_REASON_HEADER, reason);
  return c.text('404 Not Found', 404);
}

/** Env var name for the debug window. Unset = off = today's behaviour. */
export const OPS_FOUNDER_DEBUG_ENV = 'OPS_FOUNDER_DEBUG';

/** The header the reason rides on while the window is open. */
export const OPS_DEBUG_REASON_HEADER = 'X-Goblin-Ops-Reason';

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * THE DEBUG WINDOW — why it exists, and exactly what it costs while it is open.
 *
 * The refusal above is deliberately mute. That is correct for production and it is
 * also why a misconfigured allowlist cost a full diagnosis session: the founder set
 * `OPS_FOUNDER_ACCOUNTS`, got the same 404 a stranger gets, and had no way to learn
 * whether the variable had not landed, his email did not match, or his token had
 * expired. The reason was written to the server log and nowhere else — and the log
 * is exactly what a founder operating from a phone does not have.
 *
 * ── The trade, stated plainly ───────────────────────────────────────────────
 * While `OPS_FOUNDER_DEBUG=true`, any human WITH A VALID GOBLIN LOGIN who requests
 * a console path learns that something gated exists there. They cannot reach it,
 * they learn nothing about who may, and the body stays `404 Not Found` — but the
 * property "indistinguishable from an unrouted path" is gone for authenticated
 * callers. That is a real reduction and it is why this is a WINDOW, not a feature:
 * it is off by default, the founder opens it, reads one answer, and closes it.
 *
 * A caller with no token, a malformed token, or an invalid token learns exactly
 * nothing — the same as today. The header is never attached unless the bearer
 * resolved to a real Supabase user, so the surface is never widened for strangers,
 * only for people who are already inside the front door.
 *
 * ── Why `not_configured` needs its own Supabase call ────────────────────────
 * `resolveFounder()` checks the allowlist BEFORE it touches Supabase, on purpose:
 * with nothing configured it never makes a network call and cannot leak through a
 * mis-parsed env value. That ordering means that on the `not_configured` path we
 * have not established whether the caller is a real user — and `not_configured` is
 * precisely the answer the founder most needs. So the window, and ONLY the window,
 * pays for one extra `getUser()` on that path. With the flag off the fast path is
 * untouched and no extra call is ever made.
 * ════════════════════════════════════════════════════════════════════════════════
 */
export function opsFounderDebugEnabled(): boolean {
  return envFlag(OPS_FOUNDER_DEBUG_ENV);
}

/**
 * Does this bearer belong to a real Supabase user? Used only to decide whether a
 * refusal may carry its reason. Never throws — an unreachable Supabase answers
 * `false`, i.e. say nothing, which is the fail-closed direction for a disclosure.
 */
async function bearerIsRealUser(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(authHeader.substring(7));
    return !error && !!data?.user;
  } catch {
    return false;
  }
}

/**
 * The reason to disclose on this refusal, or `undefined` to stay mute.
 *
 * Short-circuits by reason so the window costs at most ONE extra Supabase call, and
 * usually none:
 *   • `no_bearer` / `invalid_token` — definitionally not a real user. Mute.
 *   • `auth_error` — Supabase was unreachable, so realness is UNKNOWN. Mute, because
 *     "we could not tell" must never be rendered as "you are known".
 *   • `no_email` / `not_allowlisted` — `resolveFounder()` already resolved this token
 *     to a real user. Disclose, no second call.
 *   • `not_configured` — realness not yet established. One `getUser()`, window only.
 */
async function debugReason(
  authHeader: string | undefined,
  reason: FounderAuthDeny,
): Promise<string | undefined> {
  if (!opsFounderDebugEnabled()) return undefined;

  switch (reason) {
    case 'no_bearer':
    case 'invalid_token':
    case 'auth_error':
      return undefined;
    case 'no_email':
    case 'not_allowlisted':
      return reason;
    case 'not_configured':
      return (await bearerIsRealUser(authHeader)) ? reason : undefined;
  }
}

export type OpsFounderPrincipal = { userId: string; email: string };

export type OpsFounderVariables = { opsFounder: OpsFounderPrincipal };

/** Why a request was refused. Logged server-side, NEVER returned to a caller. */
export type FounderAuthDeny =
  | 'not_configured'
  | 'no_bearer'
  | 'invalid_token'
  | 'no_email'
  | 'not_allowlisted'
  | 'auth_error';

export type FounderAuthResult =
  | { ok: true; principal: OpsFounderPrincipal }
  | { ok: false; reason: FounderAuthDeny };

/**
 * Resolve a bearer token to a founder principal, and say WHY when it does not.
 *
 * The reason exists so the server log is true. A single collapsed "denied" would
 * have made every refusal look alike in the log as well as on the wire, and the
 * log is the only place the operator can find out that, say, their token expired
 * rather than their email being off the list. It is never sent to a client — the
 * wire answer stays one indistinguishable 404.
 *
 * Never throws: an unreachable Supabase is a refusal, not a 500.
 */
export async function resolveFounder(authHeader: string | undefined): Promise<FounderAuthResult> {
  // Cheapest check first: with no allowlist configured we never touch Supabase and
  // cannot leak through a mis-parsed env value.
  if (!opsFounderConfigured()) return { ok: false, reason: 'not_configured' };
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { ok: false, reason: 'no_bearer' };

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(authHeader.substring(7));
    if (error || !data?.user) return { ok: false, reason: 'invalid_token' };
    const email = data.user.email ?? null;
    if (!email) return { ok: false, reason: 'no_email' };
    if (!isOpsFounderAccount(email)) return { ok: false, reason: 'not_allowlisted' };
    return { ok: true, principal: { userId: data.user.id, email } };
  } catch (err) {
    logger.warn({ reason: (err as Error)?.message }, 'ops_founder_auth_error');
    return { ok: false, reason: 'auth_error' };
  }
}

/**
 * The principal, or null.
 *
 * Exported because routes/ops-admin.ts needs exactly this — a SECOND authorization
 * path alongside `x-admin-key` — without inheriting this middleware's 404, since
 * the admin surface answers 401 and must keep doing so unchanged.
 */
export async function founderFromBearer(authHeader: string | undefined): Promise<OpsFounderPrincipal | null> {
  const result = await resolveFounder(authHeader);
  return result.ok ? result.principal : null;
}

export const opsFounderGate = createMiddleware<{ Variables: OpsFounderVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const result = await resolveFounder(authHeader);
  if (!result.ok) {
    logger.warn({ path: c.req.path, reason: result.reason }, 'ops_founder_denied');
    // The log line above is unchanged and remains the authoritative record. The
    // header below exists only while the debug window is open — see its header.
    return notFound(c, await debugReason(authHeader, result.reason));
  }

  c.set('opsFounder', result.principal);
  await next();
});
