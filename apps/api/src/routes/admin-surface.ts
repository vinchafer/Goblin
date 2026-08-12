/**
 * AKT 2 · PHASE 2.5 — mounting the /api/admin surface, in the ONE order that works.
 *
 * ── The defect this file exists to make impossible ───────────────────────────
 * `routes/ops-admin.ts` has had a second authorization path since Phase 2.5: a
 * session whose account email is on `OPS_FOUNDER_ACCOUNTS` may call the operator
 * routes with its ordinary bearer token, no admin key. Its unit tests
 * (ops-admin-founder.test.ts) proved it, because they call `opsAdmin.request()`
 * directly — the router in isolation.
 *
 * Mounted into the real app, it did not work. `/api/admin` was routed FIRST, and
 * `routes/admin.ts` opens with `admin.use('*', …)`, which after mounting matches
 * `/api/admin/*` — including `/api/admin/ops/apps/:id/suspend`. Hono runs matching
 * handlers in REGISTRATION order, so the admin-key gate ran before the operator
 * mount was ever consulted and answered `401 {"error":"Unauthorized"}` for a
 * founder session. The admin-key path still worked (that gate calls `next()`, and
 * the chain then reached the operator handler), which is exactly why the console's
 * suspend and teardown buttons 401'd while every key-holding caller saw nothing
 * wrong.
 *
 * ── The order, and why each line is where it is ──────────────────────────────
 * `/api/admin/ops` is registered BEFORE `/api/admin`. Its own gate then runs first,
 * and — this is the load-bearing part — the operator HANDLER answers without
 * calling `next()`, so the broad admin-key gate is never reached for a request the
 * operator surface actually serves. A path under `/api/admin/ops` that opsAdmin does
 * NOT serve still falls through to the admin-key gate, i.e. the fall-through is
 * strictly tighter, never looser.
 *
 * `/api/admin/rankings` is order-independent — routes/admin-rankings.ts carries its
 * own byte-identical `x-admin-key` gate — and is left where it has always been.
 *
 * ── Why a function instead of three lines in index.ts ────────────────────────
 * So the regression test (admin-surface.test.ts) can assert against the PRODUCTION
 * composition rather than a hand-copied imitation of it. The bug above was invisible
 * to every router-level test in the repo; a test that re-declares the mount order
 * would have been invisible to it too. This function is the single definition, used
 * by index.ts and by the test.
 *
 * ── What is NOT widened ──────────────────────────────────────────────────────
 * Nothing about `routes/admin.ts` changes. The rest of `/api/admin` still requires
 * `x-admin-key` and still answers `401 {"error":"Unauthorized"}` to everyone else —
 * a founder bearer opens the operator routes and nothing besides. Under test.
 */

import type { Hono } from 'hono';
import { admin } from './admin';
import { adminRankings } from './admin-rankings';
import { opsAdmin } from './ops-admin';

// The app index.ts builds. Only `route()` is used here; the generic is spelled out
// so this file does not force index.ts's Variables onto anything.
type MountTarget = Pick<Hono<{ Variables: { requestId: string } }>, 'route'>;

export function mountAdminSurface(app: MountTarget): void {
  // AKT 2 · PHASE 2 · U2.5 — the operator surface (suspend / unsuspend / teardown /
  // orphan sweep). Two ways in: the SAME x-admin-key as the rest of /api/admin, or
  // a founder session (PHASE 2.5 · U-C1). NOT behind the beta allowlist and not
  // behind OPS_HOSTING_ENABLED: the router serves from KV and never asks the API
  // anything, so the per-app emergency stop must keep working with hosting off —
  // the kill switch must never be able to disarm the kill switch.
  //
  // ⚠ MUST stay above '/api/admin'. See this file's header: below it, the
  // admin-key gate matches first and the founder path answers 401.
  app.route('/api/admin/ops', opsAdmin);

  // Its own x-admin-key gate (routes/admin-rankings.ts) — position does not matter.
  app.route('/api/admin/rankings', adminRankings);

  // The broad admin surface. Its `use('*')` gate matches everything under
  // /api/admin, which is why it is registered last.
  app.route('/api/admin', admin);
}
