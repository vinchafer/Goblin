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
 * response body is byte-identical in every refusal path — hosting disabled, bad
 * token, valid token but not allowlisted — so nothing can be inferred by
 * comparing responses. The real reason is logged server-side, never returned.
 *
 * This is honest degradation, not a phantom: nothing anywhere in the product
 * links to, mentions, or implies these routes while the flag is off.
 */

import { createMiddleware } from 'hono/factory';
import { getSupabaseAdmin } from '../lib/supabase';
import { isOpsBetaAccount, opsBetaDenyReason, opsHostingEnabled } from '../services/ops-beta';
import logger from '../lib/logger';

/** The single refusal shape. Identical for every deny reason, by design. */
const NOT_FOUND = { error: 'not_found' } as const;

export type OpsPrincipal = { userId: string; email: string };

export type OpsGateVariables = { opsPrincipal: OpsPrincipal };

export const opsGate = createMiddleware<{ Variables: OpsGateVariables }>(async (c, next) => {
  // Dimension 1 first: with the kill switch off we never touch Supabase, never
  // read the allowlist, and cannot leak through a mis-parsed allowlist value.
  if (!opsHostingEnabled()) {
    logger.debug({ path: c.req.path }, 'ops_gate_denied:hosting_disabled');
    return c.json(NOT_FOUND, 404);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.debug({ path: c.req.path }, 'ops_gate_denied:no_bearer');
    return c.json(NOT_FOUND, 404);
  }

  let email: string | null = null;
  let userId: string | null = null;
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(authHeader.substring(7));
    if (error || !data?.user) {
      logger.debug({ path: c.req.path }, 'ops_gate_denied:invalid_token');
      return c.json(NOT_FOUND, 404);
    }
    email = data.user.email ?? null;
    userId = data.user.id;
  } catch (err) {
    // Supabase unreachable → fail CLOSED. An ops surface that opens when auth is
    // down is worse than an ops surface that is briefly unavailable to its one
    // beta account.
    logger.warn({ path: c.req.path, reason: (err as Error)?.message }, 'ops_gate_denied:auth_error');
    return c.json(NOT_FOUND, 404);
  }

  // Dimension 2: the allowlist.
  if (!isOpsBetaAccount(email)) {
    logger.warn(
      { path: c.req.path, userId, reason: opsBetaDenyReason(email) },
      'ops_gate_denied',
    );
    return c.json(NOT_FOUND, 404);
  }

  c.set('opsPrincipal', { userId: userId!, email: email! });
  await next();
});
