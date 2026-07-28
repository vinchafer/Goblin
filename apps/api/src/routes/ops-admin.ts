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
 */

import { Hono } from 'hono';
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

const opsAdmin = new Hono();

/** Byte-identical to routes/admin.ts — one admin auth pattern, not two. */
opsAdmin.use('*', async (c, next) => {
  const adminKey = c.req.header('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || !adminKey || adminKey !== expectedKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

/**
 * Who is doing this. The admin key proves authorisation, not identity, so the
 * actor is asked for explicitly and falls back to a value that is honest about
 * what we actually know rather than inventing a name.
 */
function actorFrom(c: { req: { header: (n: string) => string | undefined } }, bodyActor?: string): string {
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
