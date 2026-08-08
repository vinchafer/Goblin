/**
 * AKT 2 · PHASE 2.5 · U-C2/C3/C4 — the routes that back the founder console.
 *
 * Mounted at /api/ops-console. EVERY route here is behind `opsFounderGate`, so
 * with `OPS_FOUNDER_ACCOUNTS` unset (the default) this whole surface 404s for
 * everyone — the founder included — in bytes identical to a path that was never
 * routed.
 *
 * ── Why its OWN mount, and not a sub-path of /api/ops ────────────────────────
 * `/api/ops` is behind `opsGate`, which ANDs in `OPS_HOSTING_ENABLED`. That is
 * correct for the ops plane and wrong for this one, for a specific reason: the
 * console's job is to TELL THE OPERATOR what state the plane is in, and "hosting
 * is off" is one of the answers it has to be able to give. Behind opsGate, the
 * flag being off would answer that question with a 404 and the operator would be
 * left guessing whether the console was broken, their session was stale, or the
 * flag was down. A status card that can say "aus" is worth more than one that
 * disappears.
 *
 * The same reasoning is why the operator surface (/api/admin/ops) sits outside the
 * beta gate, and it is the Phase-2 finding this phase was told to preserve: going
 * dark must not disarm the stop.
 *
 * ── What this file does NOT do ───────────────────────────────────────────────
 * It does not re-implement the router, the publish path, the scan or the E2E. The
 * console drives the EXISTING endpoints for those (/api/ops/router/provision,
 * /api/ops/apps/publish, /api/admin/ops/…). What lives here is only what the
 * console needs and nothing else has: one assembled status read, an operator-wide
 * app list, and the job wrapper that makes a 15-minute run pollable from a phone.
 *
 * ── UNKNOWN is a value ───────────────────────────────────────────────────────
 * Every probe below can answer `null`, and `null` is passed through as `null`. A
 * failed check is never rendered as `false`, because "we could not tell" and "it
 * is not there" are different facts and lead to different founder actions.
 */

import { Hono } from 'hono';
import { opsFounderGate, type OpsFounderVariables } from '../middleware/ops-founder-gate';
import { opsHostingEnabled, opsBetaEmails } from '../services/ops-beta';
import { routerStatus } from '../services/ops-router-deploy';
import { listAllOpsApps, opsAppsTableAvailable } from '../services/ops-apps-store';
import { opsAuditTableAvailable } from '../services/ops-audit';
import { appUrl } from '../services/ops-app-names';
import { opsAppsDomain } from '../services/cf-deploy';
import { startE2EJob, getE2EJob, runningE2EJob } from '../services/ops-e2e-jobs';
import { E2E_CONFIRM } from '../services/ops-e2e';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

type Variables = OpsFounderVariables;

const opsConsole = new Hono<{ Variables: Variables }>();

opsConsole.use('*', opsFounderGate);

/** Run a probe that may fail, and return `null` rather than a guess when it does. */
async function tri<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ probe: label, reason: (err as Error)?.message }, 'ops_console_probe_failed');
    return null;
  }
}

/**
 * GET /api/ops-console/status — everything the status header shows, in one call.
 *
 * One call and not four, because a phone on mobile data should not need four
 * round-trips to answer "can I start". Each check still reports independently, so
 * one failing probe degrades one line rather than the whole header.
 *
 * Note `hosting.enabled` is a real boolean and never null: it is a local env read
 * that cannot fail. Everything that crosses the network is tri-state.
 */
opsConsole.get('/status', async (c) => {
  const founder = c.get('opsFounder');
  const started = Date.now();

  const [router, registryAvailable, auditAvailable] = await Promise.all([
    tri('router', routerStatus),
    tri('registry', () => opsAppsTableAvailable()),
    tri('audit', () => opsAuditTableAvailable()),
  ]);

  return c.json({
    // Who the server thinks is calling. The console shows it so the operator can
    // tell at a glance that they are on the right account.
    founder: { email: founder.email },
    hosting: {
      // The global Act-2 kill switch. False here does NOT mean the console is
      // broken — it means /api/ops is dark, which the console says in words.
      enabled: opsHostingEnabled(),
      // Count only. The addresses themselves are server-side and stay there.
      betaAccountCount: opsBetaEmails().length,
    },
    router: router
      ? {
          domain: router.domain,
          pattern: router.pattern,
          workerDeployed: router.workerDeployed,
          zoneFound: router.zoneFound,
          // The documented trap: a wildcard record that EXISTS but is not proxied
          // means the Worker never runs. Reported as its own flag, never folded
          // into "DNS ok".
          wildcardProxied: router.wildcardProxied,
          routeBound: router.routeBound,
          notes: router.notes,
        }
      : null,
    migrations: {
      // 0099 — the registry. Without it the publish path refuses by design.
      registry: registryAvailable,
      // 0100 — the audit table. Without it suspensions still work and report
      // audit:"unavailable"; they do not silently pretend to have written a row.
      audit: auditAvailable,
    },
    appsDomain: opsAppsDomain(),
    e2e: {
      confirm: E2E_CONFIRM,
      running: runningE2EJob()?.id ?? null,
    },
    tookMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/ops-console/apps — every Living App, for the operator.
 *
 * Not scoped to the founder's own account: suspend and teardown are powers over
 * anyone's app, so the surface offering them must be able to list anyone's app.
 *
 * `available:false` means the registry could not be read (pre-0099, or a failed
 * read). The console renders that as UNKNOWN — emphatically not as "no apps".
 */
opsConsole.get('/apps', async (c) => {
  const { available, apps } = await listAllOpsApps();
  const domain = opsAppsDomain();
  return c.json({
    available,
    apps: apps.map((a) => ({
      appId: a.appId,
      name: a.appName,
      url: appUrl(a.appName, domain),
      status: a.status,
      userId: a.userId,
      projectId: a.projectId,
      lastPublishedAt: a.lastPublishedAt,
      createdAt: a.createdAt,
    })),
    timestamp: new Date().toISOString(),
  });
});

/**
 * The columns the picker reads, and the one it orders by.
 *
 * ── Why these are constants ──────────────────────────────────────────────────
 * This route used to ask `projects` for `updated_at` and order by it. That column
 * has never existed: `projects` is created in migration 0001 with `created_at` and
 * `last_active`, and no later migration adds `updated_at` (the app's own list route,
 * routes/projects.ts, correctly orders by `last_active`). PostgREST answered 42703
 * on every call, the route did the honest thing and reported `available:false`, and
 * the console said "Die Projektliste konnte nicht geladen werden" — truthfully, for
 * a reason nobody could see. A typo in a string literal cost a founder window.
 *
 * Naming them here means the column set is one exported fact that a test can hold
 * against the committed migrations (ops-console.test.ts) instead of a literal that
 * is only ever validated in production.
 */
export const PROJECT_PICKER_COLUMNS = ['id', 'name', 'last_active'] as const;
/** Newest-touched first — the same ordering the ordinary project list uses. */
export const PROJECT_PICKER_ORDER = 'last_active';

/**
 * GET /api/ops-console/projects — the signed-in account's projects, for the picker.
 *
 * Scoped to the founder's OWN user id, unlike /apps. Publishing is done as the
 * owner of a project (POST /api/ops/apps/publish re-checks ownership and 404s
 * otherwise), so offering someone else's project here would be a phantom
 * affordance: a picker entry that could only ever produce a refusal.
 */
opsConsole.get('/projects', async (c) => {
  const founder = c.get('opsFounder');
  const { data, error } = await getSupabaseAdmin()
    .from('projects')
    .select(PROJECT_PICKER_COLUMNS.join(', '))
    .eq('user_id', founder.userId)
    .order(PROJECT_PICKER_ORDER, { ascending: false })
    .limit(50);

  if (error) {
    logger.warn({ reason: error.message }, 'ops_console_projects_failed');
    // available:false, not an empty list — "we could not read your projects" and
    // "you have none" must not look alike in the picker.
    //
    // `detail` is the database's own words, capped. This surface is founder-only
    // (opsFounderGate above), the reader is the one person who can act on a schema
    // error, and the alternative is what actually happened: a console that knew the
    // reason and showed a sentence with nothing behind it.
    return c.json({
      available: false,
      projects: [],
      detail: `${error.code ?? ''} ${error.message ?? ''}`.trim().slice(0, 300) || null,
    });
  }
  return c.json({
    available: true,
    projects: (data ?? []).map((p) => {
      const row = p as unknown as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name ?? ''),
        // The picker's own name for it. `last_active` is what the column is called;
        // `updatedAt` is what the console has always received, and renaming the wire
        // field would have been a second change for no reader's benefit.
        updatedAt: (row[PROJECT_PICKER_ORDER] as string | null) ?? null,
      };
    }),
  });
});

/**
 * GET /api/ops-console/probe?name=<appName> — what does the PUBLIC url answer?
 *
 * ── Why this exists at all ───────────────────────────────────────────────────
 * The console has to report how many seconds a suspension actually took to become
 * visible, and it must MEASURE that rather than assume it (KV route writes are
 * eventually consistent with a 60-second read cache — the E2E runner polls for the
 * same reason). A browser cannot do the measuring: a cross-origin `fetch` to
 * `*.justgoblin.app` cannot read the status code, and `mode:'no-cors'` returns an
 * opaque response that says nothing. So the API looks, and reports what it saw.
 *
 * ── Why it takes a NAME and not a URL ────────────────────────────────────────
 * A route that fetches a caller-supplied URL is an SSRF hole, gate or no gate —
 * one bad day away from being pointed at a metadata endpoint or an internal host.
 * This takes the app's hostname LABEL and builds the URL itself from
 * `opsAppsDomain()`, so the only thing reachable is a public app hostname. The
 * label is validated to the same charset a hostname label may contain, which
 * leaves no room for a `..`, a `@`, a scheme or a port.
 *
 * One request, one look. The polling loop lives in the console, so what it counts
 * is elapsed wall-clock across real answers rather than a number this route made up.
 */
const APP_LABEL = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

opsConsole.get('/probe', async (c) => {
  const name = (c.req.query('name') ?? '').trim().toLowerCase();
  if (!APP_LABEL.test(name)) {
    return c.json({ error: 'invalid_name', message: 'Kein gültiger App-Name.' }, 400);
  }

  const domain = opsAppsDomain();
  if (!domain) {
    return c.json({ error: 'no_domain', message: 'OPS_APPS_DOMAIN ist nicht gesetzt — es gibt keine öffentliche Adresse zum Nachsehen.' }, 503);
  }

  const url = appUrl(name, domain);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'manual',
      headers: { 'User-Agent': 'goblin-ops-console/1.0' },
    });
    return c.json({ url, status: res.status, reachable: true, tookMs: Date.now() - started });
  } catch (err) {
    // Unreachable is NOT a status. Reporting it as 0 or 404 would be a guess.
    return c.json({
      url,
      status: null,
      reachable: false,
      detail: (err as Error)?.message?.slice(0, 200) ?? 'unknown',
      tookMs: Date.now() - started,
    });
  }
});

/**
 * POST /api/ops-console/e2e/start?confirm=RUN-E2E — begin a run, answer at once.
 *
 * The confirm token is kept from POST /api/ops/e2e verbatim: this writes to
 * production R2, KV and Postgres, and no link, prefetch or crawler may start it.
 * The gate above already means only the founder can reach it; the token is the
 * second, deliberate speed bump against an accidental tap.
 *
 * 409 when a run is already in flight. Two concurrent runs would interleave writes
 * on the same substrate and produce two reports that are each other's noise.
 */
opsConsole.post('/e2e/start', async (c) => {
  const founder = c.get('opsFounder');

  if (c.req.query('confirm') !== E2E_CONFIRM) {
    return c.json(
      { error: 'confirm_required', message: `Dieser Lauf schreibt auf die echte Infrastruktur. Zum Starten: ?confirm=${E2E_CONFIRM}` },
      400,
    );
  }

  const already = runningE2EJob();
  if (already) {
    return c.json(
      {
        error: 'already_running',
        jobId: already.id,
        message: 'Es läuft bereits ein Ende-zu-Ende-Lauf. Zwei gleichzeitige Läufe würden sich gegenseitig stören.',
      },
      409,
    );
  }

  const loopsParam = Number(c.req.query('loops'));
  const job = startE2EJob({
    userId: founder.userId,
    actor: founder.email,
    ...(Number.isFinite(loopsParam) ? { loops: loopsParam } : {}),
  });

  return c.json({ jobId: job.id, status: job.status, startedAt: job.startedAt, loops: job.loops }, 202);
});

/**
 * GET /api/ops-console/e2e/status/:id — what has ACTUALLY landed so far.
 *
 * 404 for an id this process does not know. That is the honest answer and it is
 * not the same as failure: the job map lives in memory, so a redeploy loses the
 * VIEW while the run's writes — which are real HTTP calls to Cloudflare and
 * Supabase — may well have completed. The body says exactly that, in German, so
 * the console can show it rather than inventing an outcome.
 */
opsConsole.get('/e2e/status/:id', async (c) => {
  const job = getE2EJob(c.req.param('id'));
  if (!job) {
    return c.json(
      {
        error: 'unknown_job',
        message:
          'Dieser Lauf ist diesem Server nicht bekannt. Der Fortschritt wird im Arbeitsspeicher gehalten — nach einem Redeploy ist die Ansicht weg, der Lauf selbst kann trotzdem durchgelaufen sein. Was er geschrieben hat, steht in der App-Liste und im Protokoll.',
      },
      404,
    );
  }
  return c.json(job);
});

export { opsConsole };
