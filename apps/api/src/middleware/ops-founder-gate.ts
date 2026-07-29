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
import logger from '../lib/logger';

/**
 * The single refusal. Byte-identical to Hono's built-in notFound response and to
 * middleware/ops-gate.ts's, so a console route refuses exactly as a non-existent
 * route does.
 */
function notFound(c: Context) {
  return c.text('404 Not Found', 404);
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
  const result = await resolveFounder(c.req.header('Authorization'));
  if (!result.ok) {
    logger.warn({ path: c.req.path, reason: result.reason }, 'ops_founder_denied');
    return notFound(c);
  }

  c.set('opsFounder', result.principal);
  await next();
});
