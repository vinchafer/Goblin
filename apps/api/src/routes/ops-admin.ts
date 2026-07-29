/**
 * AKT 2 · PHASE 2 · U2.5 — the operator surface for hosted apps.
 *
 * Mounted at /api/admin/ops. Guarded by the SAME `x-admin-key` middleware as every
 * other admin route (routes/admin.ts) — deliberately NOT by the beta allowlist:
 *
 *   • Suspension is an operator power, not a beta feature. It must work when
 *     OPS_HOSTING_ENABLED is false, because that flag turns off the API surface and
 *     does nothing to the router (which serves from KV and R2 and never asks the
 *     API anything). Gating the emergency stop behind the same switch that hides
 *     Act 2 would mean turning Act 2 dark also disarmed the only per-app stop.
 *   • The beta allowlist answers "may this human see Act 2 exists". A takedown is
 *     not something a beta user does to their own app.
 *
 * Without a valid key every route here answers 401 exactly as the rest of /api/admin
 * does — indistinguishable from the admin surface that has existed all along, so
 * no new fact about Act 2 leaks to anyone who probes it.
 *
 * Every write demands a REASON in the body. Not decoration: ABUSE_RESPONSE §8.4
 * requires the user be told what happened and why, and §8.5 gives them an appeal.
 * Neither is answerable from a suspension nobody wrote a sentence about.
 *
 * ── PHASE 2.5 · U-C1 — a SECOND authorization path, and why ──────────────────
 * Everything above still holds. What changed is that `x-admin-key` is no longer
 * the ONLY way in: a session whose account email is on `OPS_FOUNDER_ACCOUNTS` may
 * call these routes with its ordinary bearer token.
 *
 * The reason is not convenience, it is reachability. Suspending an app used to
 * require a terminal, a hand-copied bearer token AND the admin key — i.e. a
 * laptop. The operator has a phone. An emergency stop that cannot be reached from
 * the device the operator actually carries is an emergency stop that will be late.
 *
 * What is preserved, deliberately and under test (ops-admin-founder.test.ts):
 *   • The `x-admin-key` path is untouched. Same header, same comparison, same
 *     401 body for everyone it refuses. It is checked FIRST, so nothing about the
 *     new path can change what an existing caller experiences.
 *   • The refusal stays `401 {"error":"Unauthorized"}` — NOT the 404 the ops plane
 *     uses. This surface has answered 401 since before Act 2 existed and must keep
 *     looking exactly like the rest of /api/admin.
 *   • `OPS_FOUNDER_ACCOUNTS` is independent of OPS_HOSTING_ENABLED and of
 *     OPS_BETA_ACCOUNTS (services/ops-founder.ts), so going dark still does not
 *     disarm the kill switch. Unset → the second path admits nobody and this file
 *     behaves exactly as it did before Phase 2.5.
 *   • On the founder path the actor is the VERIFIED email and the body cannot
 *     override it. A self-declared actor is fine when the only proof of identity
 *     is a shared key; it is a downgrade once we actually know who is calling.
 */

import { Hono } from 'hono';
import { founderFromBearer, type OpsFounderPrincipal } from '../middleware/ops-founder-gate';
import {
  findApp,
  findOrphanedApps,
  purgeOrphans,
  suspendApp,
  teardownApp,
  unsuspendApp,
} from '../services/ops-operator';
import { readOpsAudit } from '../services/ops-audit';
import { appUrl } from '../services/ops-app-names';
import { opsAppsDomain } from '../services/cf-deploy';
import logger from '../lib/logger';

type Variables = { opsFounder?: OpsFounderPrincipal };

const opsAdmin = new Hono<{ Variables: Variables }>();

/**
 * Two ways in, checked in this order, refusing identically.
 *
 * 1. `x-admin-key` — byte-identical to routes/admin.ts, unchanged from Phase 2.
 *    First, so an existing caller's behaviour cannot depend on anything below it.
 * 2. A founder session — an ordinary Supabase bearer token whose account email is
 *    on OPS_FOUNDER_ACCOUNTS. Unset allowlist → this path admits nobody and the
 *    file behaves exactly as it did before.
 *
 * Neither path leaks the other's existence: the refusal is the same 401 body the
 * admin surface has always returned.
 */
opsAdmin.use('*', async (c, next) => {
  const adminKey = c.req.header('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;
  if (expectedKey && adminKey && adminKey === expectedKey) {
    await next();
    return;
  }

  const founder = await founderFromBearer(c.req.header('Authorization'));
  if (founder) {
    c.set('opsFounder', founder);
    logger.info({ actor: founder.email, path: c.req.path }, 'ops_admin_founder_session');
    await next();
    return;
  }

  return c.json({ error: 'Unauthorized' }, 401);
});

/**
 * Who is doing this.
 *
 * On the founder path we KNOW: the email came out of a verified Supabase session,
 * so it is used verbatim and the request body cannot override it. Letting a body
 * field win there would turn a verified identity back into a self-declared one,
 * and the audit row (0100) would record whatever the caller typed.
 *
 * On the admin-key path we do not know — the key proves authorisation, not
 * identity — so the actor is asked for explicitly and falls back to a value that
 * is honest about what we actually know rather than inventing a name. Unchanged
 * from Phase 2.
 */
function actorFrom(
  c: { req: { header: (n: string) => string | undefined }; get: (k: 'opsFounder') => OpsFounderPrincipal | undefined },
  bodyActor?: string,
): string {
  const founder = c.get('opsFounder');
  if (founder) return founder.email;
  return (bodyActor ?? c.req.header('x-admin-actor') ?? '').trim() || 'admin-key-holder';
}

async function readBody(c: { req: { json: <T>() => Promise<T> } }): Promise<{ reason?: string; actor?: string; appIds?: string[] }> {
  return c.req.json<{ reason?: string; actor?: string; appIds?: string[] }>().catch(() => ({}));
}

/** GET /api/admin/ops/apps/:idOrName — the row, the URL and the audit history. */
opsAdmin.get('/apps/:idOrName', async (c) => {
  const app = await findApp(c.req.param('idOrName'));
  if (!app) return c.json({ error: 'not_found' }, 404);
  return c.json({
    app: { ...app, url: appUrl(app.appName, opsAppsDomain()) },
    audit: await readOpsAudit(app.appId),
  });
});

/**
 * POST /api/admin/ops/apps/:idOrName/suspend — the per-app emergency stop.
 *
 * Reversible: files stay in R2, the row stays in the registry. Nothing here
 * destroys evidence, which §8.7 requires be secured before any irreversible step.
 *
 * 200 even when a step failed, with the per-step outcome in the body. An operator
 * mid-incident needs to read WHICH half worked, and an HTTP error code cannot say
 * "the router stopped it but the database did not".
 */
opsAdmin.post('/apps/:idOrName/suspend', async (c) => {
  const body = await readBody(c);
  const reason = (body.reason ?? '').trim();
  if (!reason) return c.json({ error: 'missing_reason', message: 'Eine Sperre braucht einen Grund — der Nutzer bekommt ihn zu lesen (§8.4).' }, 400);

  const app = await findApp(c.req.param('idOrName'));
  if (!app) return c.json({ error: 'not_found' }, 404);

  logger.warn({ appId: app.appId, actor: actorFrom(c, body.actor) }, 'ops_admin_suspend_requested');
  return c.json(await suspendApp(app, actorFrom(c, body.actor), reason));
});

/** POST /api/admin/ops/apps/:idOrName/unsuspend — §8.5, when the sperre was wrong. */
opsAdmin.post('/apps/:idOrName/unsuspend', async (c) => {
  const body = await readBody(c);
  const reason = (body.reason ?? '').trim();
  if (!reason) return c.json({ error: 'missing_reason', message: 'Auch das Entsperren braucht einen Grund — er gehört ins Protokoll.' }, 400);

  const app = await findApp(c.req.param('idOrName'));
  if (!app) return c.json({ error: 'not_found' }, 404);
  return c.json(await unsuspendApp(app, actorFrom(c, body.actor), reason));
});

/**
 * DELETE /api/admin/ops/apps/:idOrName — teardown. IRREVERSIBLE.
 *
 * DELETE, not POST: a link, a prefetch or a crawler must not be able to reach it.
 * The response carries the zero-orphan proof (prefix re-listed, route re-read), not
 * merely a claim that the deletes were issued.
 */
opsAdmin.delete('/apps/:idOrName', async (c) => {
  const body = await readBody(c);
  const reason = (body.reason ?? '').trim();
  if (!reason) return c.json({ error: 'missing_reason', message: 'Ein Teardown ist endgültig und braucht einen Grund im Protokoll (§8.7).' }, 400);

  const app = await findApp(c.req.param('idOrName'));
  if (!app) return c.json({ error: 'not_found' }, 404);

  logger.warn({ appId: app.appId, actor: actorFrom(c, body.actor) }, 'ops_admin_teardown_requested');
  return c.json(await teardownApp(app, actorFrom(c, body.actor), reason));
});

/**
 * GET /api/admin/ops/orphans — R2 prefixes with no registry row (§8.3 gap 3).
 *
 * Report only. A deleted project cascades its row away without touching its files,
 * so this is the only way to see what a deletion left behind.
 */
opsAdmin.get('/orphans', async (c) => {
  return c.json(await findOrphanedApps());
});

/**
 * POST /api/admin/ops/orphans/purge — delete named orphans, never "all of them".
 *
 * Each id is re-checked against the registry immediately before deletion, so a
 * stale list cannot delete an app published in the meantime.
 */
opsAdmin.post('/orphans/purge', async (c) => {
  const body = await readBody(c);
  const reason = (body.reason ?? '').trim();
  const appIds = Array.isArray(body.appIds) ? body.appIds.filter((id) => typeof id === 'string' && id.length > 0) : [];
  if (!reason) return c.json({ error: 'missing_reason', message: 'Auch das Aufräumen von Waisen gehört begründet ins Protokoll.' }, 400);
  if (appIds.length === 0) {
    return c.json({ error: 'missing_app_ids', message: 'Bitte die App-IDs angeben, die entfernt werden sollen — es gibt bewusst kein "alle löschen".' }, 400);
  }
  return c.json(await purgeOrphans(appIds, actorFrom(c, body.actor), reason));
});

export { opsAdmin };
