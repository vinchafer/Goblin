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
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import { isOpsBetaAccount, opsBetaDenyReason, opsHostingEnabled } from '../services/ops-beta';
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

  // Dimension 2: the allowlist.
  if (!isOpsBetaAccount(email)) {
    logger.warn(
      { path: c.req.path, userId, reason: opsBetaDenyReason(email) },
      'ops_gate_denied',
    );
    return notFound(c);
  }

  c.set('opsPrincipal', { userId: userId!, email: email! });
  await next();
});
