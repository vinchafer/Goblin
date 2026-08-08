/**
 * ACT 2 · PHASE 1 · U1.1 — the Act-2 gate as HTTP middleware.
 *
 * This is `isOpsBetaAccount()` (services/ops-beta.ts) applied at the edge of every
 * Act-2 route. Mount it with `ops.use('*', opsGate)` BEFORE any handler; it is the
 * only authorization an Act-2 route needs in order to be *invisible*, and it does
 * not replace the ordinary per-resource ownership checks a handler still owes.
 *
 * ── Why 404 and not 401/403 ───────────────────────────────────────────────────
 * Real Act-1 users are live on production. A 403 on `/api/ops/health` would tell
 * a curious cohort user that an ops plane exists and that they are excluded from
 * it; a 401 would invite them to go find a credential. 404 says the only thing
 * that is true *for them*: with the kill switch off there is no such route. The
 * response is identical in every refusal path — hosting disabled, bad token,
 * valid token but not allowlisted — so nothing can be inferred by comparing
 * responses. The real reason is logged server-side, never returned.
 *
 * ── Why it is Hono's DEFAULT 404 verbatim, not a JSON error ───────────────────
 * A distinctive refusal body is itself a disclosure. Measured against the live
 * API on 2026-07-28: an unrouted path returns `404 Not Found` as
 * `text/plain; charset=UTF-8` (Hono's built-in notFound). Had this middleware
 * answered `{"error":"not_found"}` in JSON, anyone could compare `/api/ops/xyz`
 * with `/api/xyz` and learn that an `/api/ops` mount exists — the exact fact the
 * gate is here to hide. So the refusal reproduces the framework default exactly:
 * same status, same content type, same bytes. `/api/ops/anything` is
 * indistinguishable from a route that was never mounted.
 *
 * This is honest degradation, not a phantom: nothing anywhere in the product
 * links to, mentions, or implies these routes while the flag is off.
 *
 * ── PHASE 2.5 · U-A1 — a SECOND allowlist, and why ───────────────────────────
 * Everything above still holds, byte for byte. What changed is WHO the second
 * dimension admits: the beta allowlist (`OPS_BETA_ACCOUNTS`) is no longer the only
 * answer — an account on `OPS_FOUNDER_ACCOUNTS` passes too.
 *
 * The reason is coherence, not convenience. The founder console
 * (/dashboard/konsole, routes/ops-console.ts) is gated on `OPS_FOUNDER_ACCOUNTS`,
 * and its buttons drive THESE routes: router provision, router status, publish and
 * the name check all live under /api/ops. With only the beta allowlist here, a
 * founder who was not ALSO on the beta list got a console that rendered perfectly
 * and whose every action answered 404 — the operator surface said "you may operate
 * this" and the routes said "there is nothing here". Two allowlists disagreeing
 * about the same human is a bug in the authorization, not something the UI should
 * paper over. The principle, founder-approved on 2026-08-08: WHOEVER MAY OPERATE
 * THE CONSOLE MAY EXECUTE ITS ACTIONS.
 *
 * The shape is deliberately the one routes/ops-admin.ts already uses: two
 * independent ways in, one indistinguishable refusal, neither path leaking that
 * the other exists.
 *
 * What did NOT change, and is the whole reason this is safe:
 *   • Dimension 1 is untouched and still FIRST. `OPS_HOSTING_ENABLED` still ANDs
 *     with everything below it, so publishing and every other hosting action still
 *     goes dark for the founder too. The founder does not get a bypass around the
 *     kill switch — they get a second way to satisfy dimension 2. (The operator
 *     surface that must survive going dark is /api/admin/ops, and it always has.)
 *   • With the switch off Supabase is still never asked who is calling, so the
 *     founder allowlist cannot leak through a mis-parsed value either.
 *   • `OPS_FOUNDER_ACCOUNTS` is unset by default → the second path admits nobody
 *     and this file behaves exactly as it did before. An Act-1 user on neither list
 *     gets the same byte-identical 404 as always (ops-cohort-protection.test.ts,
 *     unchanged).
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import { isOpsBetaAccount, opsBetaDenyReason, opsHostingEnabled } from '../services/ops-beta';
import { isOpsFounderAccount, opsFounderDenyReason } from '../services/ops-founder';
import logger from '../lib/logger';

/**
 * The single refusal. Byte-identical to Hono's built-in notFound response, so an
 * ops route refuses exactly as a non-existent route does.
 */
function notFound(c: Context) {
  return c.text('404 Not Found', 404);
}

export type OpsPrincipal = { userId: string; email: string };

export type OpsGateVariables = { opsPrincipal: OpsPrincipal };

export const opsGate = createMiddleware<{ Variables: OpsGateVariables }>(async (c, next) => {
  // Dimension 1 first: with the kill switch off we never touch Supabase, never
  // read the allowlist, and cannot leak through a mis-parsed allowlist value.
  if (!opsHostingEnabled()) {
    logger.debug({ path: c.req.path }, 'ops_gate_denied:hosting_disabled');
    return notFound(c);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.debug({ path: c.req.path }, 'ops_gate_denied:no_bearer');
    return notFound(c);
  }

  let email: string | null = null;
  let userId: string | null = null;
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(authHeader.substring(7));
    if (error || !data?.user) {
      logger.debug({ path: c.req.path }, 'ops_gate_denied:invalid_token');
      return notFound(c);
    }
    email = data.user.email ?? null;
    userId = data.user.id;
  } catch (err) {
    // Supabase unreachable → fail CLOSED. An ops surface that opens when auth is
    // down is worse than an ops surface that is briefly unavailable to its one
    // beta account.
    logger.warn({ path: c.req.path, reason: (err as Error)?.message }, 'ops_gate_denied:auth_error');
    return notFound(c);
  }

  // Dimension 2: an allowlist — either one. Beta is checked first because it is
  // the ordinary path and because `opsBetaDenyReason` below is written for it; the
  // founder list is the alternative, not an override.
  const viaBeta = isOpsBetaAccount(email);
  const viaFounder = !viaBeta && isOpsFounderAccount(email);

  if (!viaBeta && !viaFounder) {
    logger.warn(
      // Both reasons, because "why was this refused" now has two halves and a log
      // that showed only one would send the next diagnosis down the wrong path.
      { path: c.req.path, userId, reason: opsBetaDenyReason(email), founderReason: opsFounderDenyReason(email) },
      'ops_gate_denied',
    );
    return notFound(c);
  }

  if (viaFounder) {
    // Mirrors `ops_admin_founder_session`: an operator acting on the ops plane by
    // founder authority is worth one line in the log. The beta path stays silent —
    // it is the ordinary case and this is the exception.
    logger.info({ path: c.req.path, actor: email }, 'ops_gate_founder_session');
  }

  // The principal shape is unchanged on purpose: `email` is the VERIFIED session
  // email either way, which is what every downstream audit row records as its
  // actor (services/ops-audit.ts). A founder-authorized action is therefore
  // attributable to exactly the same degree a beta-authorized one is.
  c.set('opsPrincipal', { userId: userId!, email: email! });
  await next();
});
