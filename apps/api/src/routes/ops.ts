/**
 * ACT 2 · PHASE 1 · U1.3 — the ops health probe (and U1.5's round-trip self-test).
 *
 * Mounted at /api/ops. EVERY route here is behind `opsGate` — the Act-2 gate — so
 * with `OPS_HOSTING_ENABLED=false` (its production default) this whole surface
 * 404s for everyone, live Act-1 users and founder alike. Read-only routes are
 * gated too: the existence of an ops plane is itself information the cohort must
 * not have.
 *
 * NO SECRET MATERIAL IN ANY RESPONSE. Env vars are reported by NAME with a
 * boolean; the adapter redacts every secret VALUE out of every upstream message
 * before it can reach a response body, a log line or an evidence file. There is
 * no code path here that prints a value, a prefix, or a length.
 */

import { Hono } from 'hono';
import { opsGate, type OpsGateVariables } from '../middleware/ops-gate';
import {
  CF_ENV_VARS,
  cfEnvPresence,
  checkKvNamespace,
  checkR2,
  listWorkers,
  opsAppsDomain,
  type CfError,
} from '../services/cf-deploy';
import { opsHostingEnabled } from '../services/ops-beta';
import { runOpsSelftest, SELFTEST_APP_ID } from '../services/ops-selftest';
import { provisionRouter, routerStatus } from '../services/ops-router-deploy';
import { checkNameAvailable, publishHostedApp, renameHostedApp } from '../services/ops-publish';
import { runOpsE2E, E2E_CONFIRM } from '../services/ops-e2e';
import { findOpsAppById, listAllOpsApps, listUserOpsApps } from '../services/ops-apps-store';
// PHASE 5 · U5.3 — the same assembler the founder console uses, so the owner's
// card and the operator's list cannot disagree about the same rows.
import { appHealthReport } from '../services/ops-check-report';
import {
  acceptedThisMonth,
  allSubmissionsForExport,
  deleteAllSubmissions,
  deleteSubmission,
  listSubmissions,
  markSubmissionRead,
  notificationsEnabled,
  setNotifications,
  submissionsToCsv,
  usageMonth,
} from '../services/ops-d1';
import { monthlySubmissionBudget } from '../services/ops-caps';
// PHASE 4 — the same report the founder console renders, computed in ONE place.
// Two implementations of "is this configured" is how one surface ends up saying
// yes while the other says no.
import { formsConfigReport } from '../services/ops-forms-config';
import { appUrl } from '../services/ops-app-names';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

type Variables = OpsGateVariables;

const ops = new Hono<{ Variables: Variables }>();

ops.use('*', opsGate);

/**
 * The confirm token for "delete every submission of this app".
 *
 * German, because the person typing it is the person whose data it is, and
 * shouted, because the answer to "did you mean to do that" should be something a
 * hand cannot produce by accident.
 */
export const DELETE_ALL_CONFIRM = 'ALLES-LOESCHEN';

type CheckStatus = 'ok' | 'fail' | 'skip';

interface Check {
  status: CheckStatus;
  latencyMs?: number;
  /** Typed failure code from the adapter — never a raw upstream blob. */
  code?: CfError['code'];
  /** Redacted, length-capped upstream detail. Safe to paste into a report. */
  detail?: string;
  [extra: string]: unknown;
}

function failed(error: CfError): Check {
  return { status: 'fail', code: error.code, detail: error.message.slice(0, 300) };
}

/**
 * GET /api/ops/health — is the lean user-app plane reachable from here?
 *
 * Deterministic: four independent checks, each a real call to the substrate, each
 * reported as ok/fail/skip with a latency. `skip` means "not configured" and is
 * distinguished from `fail` ("configured but the call did not work") — a missing
 * variable and a wrong token are different founder actions and must not look alike.
 *
 * Overall status: ok = every configured check passed · degraded = at least one
 * failed or was skipped · down = every check failed. Nothing here is user-facing;
 * it exists so the founder can tell, in one request, whether Phase 2 can start.
 */
ops.get('/health', async (c) => {
  const started = Date.now();
  const presence = cfEnvPresence();
  const missing = CF_ENV_VARS.filter((name) => !presence[name]);

  const checks: Record<string, Check> = {};

  // 1. Required env vars — PRESENCE only, by name. Never a value.
  checks.env = {
    status: missing.length === 0 ? 'ok' : 'fail',
    present: presence,
    missing,
  };

  // 2. R2 reachable (HEAD bucket).
  if (!presence.CF_R2_ENDPOINT || !presence.CF_R2_BUCKET || !presence.CF_R2_ACCESS_KEY_ID || !presence.CF_R2_SECRET_ACCESS_KEY) {
    checks.r2 = { status: 'skip', reason: 'missing_env' };
  } else {
    const res = await checkR2();
    checks.r2 = res.ok ? { status: 'ok', latencyMs: res.value.latencyMs, bucket: res.value.bucket } : failed(res.error);
  }

  // 3. KV namespace reachable.
  if (!presence.CF_ACCOUNT_ID || !presence.CF_API_TOKEN || !presence.CF_KV_NAMESPACE_ID) {
    checks.kv = { status: 'skip', reason: 'missing_env' };
  } else {
    const res = await checkKvNamespace();
    checks.kv = res.ok
      ? { status: 'ok', latencyMs: res.value.latencyMs, ...(res.value.title ? { namespaceTitle: res.value.title } : {}) }
      : failed(res.error);
  }

  // 4. Workers API token scope sufficient (list scripts). Count only — proving the
  //    scope, not enumerating the account.
  if (!presence.CF_ACCOUNT_ID || !presence.CF_API_TOKEN) {
    checks.workers = { status: 'skip', reason: 'missing_env' };
  } else {
    const res = await listWorkers();
    checks.workers = res.ok
      ? { status: 'ok', latencyMs: res.value.latencyMs, scriptCount: res.value.count }
      : failed(res.error);
  }

  const values = Object.values(checks);
  const failures = values.filter((v) => v.status === 'fail').length;
  const status = failures === 0 && values.every((v) => v.status === 'ok') ? 'ok' : failures === values.length ? 'down' : 'degraded';

  logger.info({ status, failures }, 'ops_health');

  return c.json({
    status,
    hostingEnabled: opsHostingEnabled(), // always true here — the gate admitted us
    appsDomain: opsAppsDomain(), // public hostname, not a secret
    checks,
    // PHASE 4 — beside `checks`, not inside it, and deliberately NOT feeding
    // `status`: an instance with no forms configured is a correct instance, and
    // folding this in would turn a green health report degraded over a
    // configuration nobody is using.
    forms: formsConfigReport(),
    tookMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/ops/selftest — U1.5's round-trip proof, executed BY THE DEPLOYED API.
 *
 * It runs here, not in a CC session and not on the founder's laptop, because the
 * Cloudflare credentials live only in the Railway environment (OPS_SPIKE_0 §4.4:
 * a cloud CC session is not a vault). The founder triggers it with one authorized
 * request and reads the result; no token is handled by a human or a session.
 *
 * Scope is fixed and hard-coded — the R2 prefix `apps/test-roundtrip/`, the KV
 * route of the same name, one throwaway Worker. The only accepted parameter is
 * `runs` (1–10, default 3); there is no way to point it at a real app.
 *
 * POST, not GET: it writes to and deletes from the real substrate. It must never
 * be something a link, a prefetch or a crawler can trigger.
 */
ops.post('/selftest', async (c) => {
  const principal = c.get('opsPrincipal');
  const runsParam = Number(c.req.query('runs'));
  logger.warn({ userId: principal.userId, appId: SELFTEST_APP_ID }, 'ops_selftest_started');

  const report = await runOpsSelftest(Number.isFinite(runsParam) ? { runs: runsParam } : {});

  logger.warn({ userId: principal.userId, passed: report.passed, summary: report.summary }, 'ops_selftest_finished');
  // 200 whether or not the round-trips passed: the REQUEST succeeded and the
  // report is the answer. A failing round-trip is data, not an HTTP error — and
  // the founder needs to read the steps, which a thrown status would hide.
  return c.json(report);
});

// ── U2.4 · the publish path ─────────────────────────────────────────────────

/**
 * Ownership, not just allowlisting. `opsGate` answers "may this human see Act 2
 * at all"; it says nothing about whether this particular project is theirs. Both
 * checks are owed, and this is the second one.
 */
async function ownedProject(userId: string, projectId: string): Promise<{ id: string } | null> {
  const { data } = await getSupabaseAdmin()
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

/** GET /api/ops/apps — this user's Living Apps. Empty list on a pre-0099 database. */
ops.get('/apps', async (c) => {
  const principal = c.get('opsPrincipal');
  const apps = await listUserOpsApps(principal.userId);
  const domain = opsAppsDomain();
  return c.json({
    apps: apps.map((a) => ({
      appId: a.appId,
      name: a.appName,
      url: appUrl(a.appName, domain),
      status: a.status,
      projectId: a.projectId,
      lastPublishedAt: a.lastPublishedAt,
      // PHASE 4 — does this app have an inbox? A boolean, not the database id:
      // the id is a substrate fact the builder has no use for and no business
      // holding, and this surface has never emitted one.
      hasForms: a.d1DatabaseId !== null,
    })),
  });
});

/**
 * GET /api/ops/apps/name-check?name=… — is this name free?
 *
 * A read, so a name field can answer while someone types. It is NOT the claim: two
 * people can both be told "frei" and only one insert survives the unique index.
 * Saying so here keeps the check from being mistaken for a reservation.
 */
ops.get('/apps/name-check', async (c) => {
  const result = await checkNameAvailable(c.req.query('name') ?? '');
  return c.json({
    name: result.normalized,
    available: result.ok,
    ...(result.ok ? { url: result.url } : { reason: result.reason, message: result.message }),
  });
});

/**
 * POST /api/ops/apps/publish — scan, upload, route, verify, and only then "live".
 *
 * Idempotent: a project has at most one Living App, so republishing reuses the app
 * id and keeps the URL people already have.
 *
 * A scan block answers 422, not 500: the request was well-formed and the answer is
 * "no". The German message is the payload that matters; the rule ids ride along for
 * the appeal, never in the message itself.
 */
ops.post('/apps/publish', async (c) => {
  const principal = c.get('opsPrincipal');
  const body = await c.req.json<{ projectId?: string; name?: string }>().catch(() => ({}) as { projectId?: string; name?: string });
  const projectId = (body.projectId ?? '').trim();
  const name = (body.name ?? '').trim();

  if (!projectId) return c.json({ error: 'missing_project', message: 'Es fehlt die Angabe, welches Projekt veröffentlicht werden soll.' }, 400);
  if (!(await ownedProject(principal.userId, projectId))) {
    // Same reasoning as opsGate: a 403 would confirm the project exists.
    return c.json({ error: 'not_found', message: 'Dieses Projekt gibt es nicht.' }, 404);
  }

  logger.warn({ userId: principal.userId, projectId }, 'hosted_publish_started');
  const result = await publishHostedApp({ userId: principal.userId, projectId, name });

  if (!result.ok) {
    // PHASE 3: a REVIEW is not an error and must not be answered like one. 202
    // says the request was accepted and is not finished — which is exactly what a
    // held publish is. Answering 422 (as a block does) would tell the client "you
    // did something wrong", and the builder did nothing wrong.
    if (result.code === 'scan_review') {
      return c.json({ status: 'review', stage: result.stage, message: result.message, reviewId: result.reviewId, name: result.name }, 202);
    }
    // `review_unqueued` IS ours to own: held, and we could not even record it. 503
    // — try again later — matches what the German message already says.
    if (result.code === 'review_unqueued') {
      return c.json({ error: result.code, stage: result.stage, message: result.message }, 503);
    }
    // PHASE 4: the two form failures are 503, not 502. Both mean "Goblin cannot
    // host a form right now" — a state of ours that will pass — rather than "the
    // substrate answered wrongly". The builder's next action is to try again, and
    // the status should say so.
    const status =
      result.code === 'scan_blocked'
        ? 422
        : result.code === 'name_taken' || result.code === 'name_released' || result.code === 'invalid_name'
          ? 409
          : result.code === 'form_unwirable' || result.code === 'd1_unavailable'
            ? 503
            : 502;
    return c.json({ error: result.code, stage: result.stage, message: result.message, ...(result.url ? { url: result.url } : {}) }, status);
  }
  return c.json(result);
});

/**
 * GET /api/ops/eligibility — "may this account publish on the hosted path?"
 *
 * The whole point is that there is no interesting body. The ANSWER is the status
 * code: behind `opsGate`, this route is a byte-identical 404 for everyone who is
 * not allowlisted (and for everyone, allowlisted or not, when
 * `OPS_HOSTING_ENABLED` is off). So the web app asks, and a 404 means "show the
 * sheet you have always shown" — it never learns that an allowlist exists.
 *
 * Why the web app needs a route at all: `OPS_BETA_ACCOUNTS` lives in the API's
 * environment. Copying it into Vercel would be a second place to get it wrong and
 * a second place for it to leak into a client bundle (the same argument
 * app/dashboard/konsole/page.tsx makes for the founder gate).
 *
 * It is a READ and it claims nothing: eligibility is not a reservation, not a
 * quota grant, and not a promise that the publish will succeed.
 */
ops.get('/eligibility', async (c) => {
  return c.json({ hosted: true, appsDomain: opsAppsDomain() });
});

/**
 * POST /api/ops/apps/:appId/rename — move the app, leave an honest 410 behind.
 *
 * The old address is tombstoned rather than redirected: see renameHostedApp for
 * why a redirect would be a lie to everyone holding the old link.
 */
ops.post('/apps/:appId/rename', async (c) => {
  const principal = c.get('opsPrincipal');
  const appId = c.req.param('appId');
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });

  const app = await findOpsAppById(appId);
  // Ownership again, and 404 rather than 403 for someone else's app.
  if (!app || app.userId !== principal.userId) {
    return c.json({ error: 'not_found', message: 'Diese App gibt es nicht.' }, 404);
  }

  const result = await renameHostedApp(app, body.name ?? '');
  if (!result.ok) return c.json({ error: result.code, message: result.message }, result.code === 'route_failed' || result.code === 'registry_unavailable' ? 502 : 409);
  return c.json(result);
});

// ── U4.4 · the owner's inbox ────────────────────────────────────────────────
//
// THE OWNER'S DATA, ON THE OWNER'S SURFACE. Deliberately here — behind `opsGate`,
// which is the builder's own gate — and NOT in the founder console. The console is
// where an operator acts on somebody else's app; this is somebody reading their own
// messages, and putting it there would mean the only way to see your own contact
// form was for the founder to look for you.
//
// Ownership is checked on EVERY route below, and the answer for somebody else's app
// is 404 rather than 403 — the same rule the rest of this file follows, for the same
// reason: a 403 confirms the app exists.

/**
 * The app, if it belongs to this user AND has a database. `null` otherwise.
 *
 * The two conditions are collapsed on purpose: an app with no form has no inbox,
 * and telling its owner "no submissions yet" would be a promise that one might
 * arrive. The caller answers 404 for both.
 */
async function ownedInboxApp(userId: string, appId: string) {
  const app = await findOpsAppById(appId);
  if (!app || app.userId !== userId || !app.d1DatabaseId) return null;
  return app as typeof app & { d1DatabaseId: string };
}

const NO_INBOX = { error: 'not_found', message: 'Diese App gibt es nicht, oder sie hat kein Formular.' } as const;

/**
 * GET /api/ops/apps/:appId/submissions — newest first.
 *
 * `available: false` is NOT an empty list. A database that cannot be read means
 * nobody can say whether anything arrived, and an inbox rendering that as "noch
 * keine Einsendungen" is the silent-empty-card defect this codebase has met before.
 */
ops.get('/apps/:appId/submissions', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await ownedInboxApp(principal.userId, c.req.param('appId'));
  if (!app) return c.json(NO_INBOX, 404);

  const limit = Number(c.req.query('limit'));
  const offset = Number(c.req.query('offset'));
  const page = await listSubmissions(app.d1DatabaseId, {
    ...(Number.isFinite(limit) ? { limit } : {}),
    ...(Number.isFinite(offset) ? { offset } : {}),
  });

  if (!page) {
    return c.json({
      available: false,
      message: 'Der Posteingang liess sich gerade nicht lesen. Das heißt NICHT, dass nichts da ist — wir konnten nur nicht nachsehen.',
    });
  }
  return c.json({
    available: true,
    total: page.total,
    monthlyCap: monthlySubmissionBudget(app.capsProfile),
    acceptedThisMonth: await acceptedThisMonth(app.d1DatabaseId, usageMonth()),
    notifications: await notificationsEnabled(app.d1DatabaseId),
    submissions: page.submissions,
  });
});

/** POST …/submissions/:id/read — mark one read. Idempotent; already-read is not an error. */
ops.post('/apps/:appId/submissions/:submissionId/read', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await ownedInboxApp(principal.userId, c.req.param('appId'));
  if (!app) return c.json(NO_INBOX, 404);
  const done = await markSubmissionRead(app.d1DatabaseId, c.req.param('submissionId'));
  return done
    ? c.json({ ok: true })
    : c.json({ error: 'not_saved', message: 'Das liess sich gerade nicht speichern. Bitte versuch es gleich noch einmal.' }, 503);
});

/**
 * GET …/submissions.csv — the export.
 *
 * A GET because it is a download, and it is the owner's own data behind their own
 * session. Bounded at 5.000 rows, and it SAYS SO in a header rather than quietly
 * handing over a truncated file that looks complete.
 */
ops.get('/apps/:appId/submissions.csv', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await ownedInboxApp(principal.userId, c.req.param('appId'));
  if (!app) return c.json(NO_INBOX, 404);

  const all = await allSubmissionsForExport(app.d1DatabaseId);
  if (!all) {
    return c.json(
      { error: 'unavailable', message: 'Der Export liess sich gerade nicht erstellen. Bitte versuch es gleich noch einmal.' },
      503,
    );
  }
  return new Response(submissionsToCsv(all.submissions), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="einsendungen-${app.appName}.csv"`,
      'cache-control': 'no-store',
      // Truthful about its own completeness, in a place a script can read.
      'x-goblin-export-truncated': all.truncated ? 'true' : 'false',
      'x-goblin-export-rows': String(all.submissions.length),
    },
  });
});

/** DELETE …/submissions/:id — one message, gone. */
ops.delete('/apps/:appId/submissions/:submissionId', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await ownedInboxApp(principal.userId, c.req.param('appId'));
  if (!app) return c.json(NO_INBOX, 404);
  const done = await deleteSubmission(app.d1DatabaseId, c.req.param('submissionId'));
  return done
    ? c.json({ ok: true })
    : c.json({ error: 'not_deleted', message: 'Das liess sich gerade nicht löschen. Bitte versuch es gleich noch einmal.' }, 503);
});

/**
 * DELETE …/submissions?confirm=ALLES-LOESCHEN — every message, gone.
 *
 * The confirm token is in the URL and it is German, because the person typing it is
 * the person whose data it is. It is not a second dialog dressed as an API: the UI
 * asks first, and this is the guard that means a stray request — a prefetch, a
 * retry, a mis-tapped link — cannot empty somebody's inbox.
 *
 * `usage_months` is deliberately not cleared (see ops-d1.ts): the monthly allowance
 * counts what was accepted, not what is still stored.
 */
ops.delete('/apps/:appId/submissions', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await ownedInboxApp(principal.userId, c.req.param('appId'));
  if (!app) return c.json(NO_INBOX, 404);
  if (c.req.query('confirm') !== DELETE_ALL_CONFIRM) {
    return c.json(
      { error: 'confirm_required', message: `Das löscht alle Einsendungen dieser App. Zum Bestätigen: ?confirm=${DELETE_ALL_CONFIRM}` },
      400,
    );
  }
  const result = await deleteAllSubmissions(app.d1DatabaseId);
  if (!result.ok) {
    return c.json({ error: 'not_deleted', message: 'Es liess sich gerade nichts löschen. Bitte versuch es gleich noch einmal.' }, 503);
  }
  logger.warn({ appId: app.appId, deleted: result.deleted }, 'ops_submissions_deleted_all');
  return c.json({ ok: true, deleted: result.deleted });
});

/** POST …/notifications — the owner's own switch, per app. */
ops.post('/apps/:appId/notifications', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await ownedInboxApp(principal.userId, c.req.param('appId'));
  if (!app) return c.json(NO_INBOX, 404);
  const body = await c.req.json<{ enabled?: boolean }>().catch(() => ({}) as { enabled?: boolean });
  const enabled = body.enabled !== false;
  const done = await setNotifications(app.d1DatabaseId, enabled);
  return done
    ? c.json({ ok: true, notifications: enabled })
    : c.json({ error: 'not_saved', message: 'Die Einstellung liess sich gerade nicht speichern. Bitte versuch es gleich noch einmal.' }, 503);
});

// ── U5.3 · the owner's status ───────────────────────────────────────────────

/**
 * GET /api/ops/apps/:appId/status — is my app up, and when did you last look?
 *
 * The owner's own surface, behind `opsGate` and an ownership check, answering 404
 * for somebody else's app exactly like every route above it.
 *
 * ── Read-only, and it does NOT trigger a check ───────────────────────────────
 * Opening the card measures nothing. It reports what the runner has already
 * measured, and if the runner has measured nothing, it says UNKNOWN. A card that
 * probed on open would show a fresh green for an app that had been dark for hours
 * — the freshest possible answer to the wrong question, and precisely the
 * cosmetics this phase exists to avoid.
 *
 * `available: false` means the check store could not be read. It is deliberately
 * NOT collapsed into "no checks yet": the card renders the two differently,
 * because "we could not look" and "we have not looked yet" lead somewhere
 * different for both the owner and the founder.
 */
ops.get('/apps/:appId/status', async (c) => {
  const principal = c.get('opsPrincipal');
  const app = await findOpsAppById(c.req.param('appId'));
  if (!app || app.userId !== principal.userId) {
    return c.json({ error: 'not_found', message: 'Diese App gibt es nicht.' }, 404);
  }
  // The cadence only affects the freshness threshold and the copy, never the state.
  // One registry read rather than a second count query; a failure here degrades to
  // "assume a small fleet", which shortens the threshold — the strict direction.
  const fleet = await listAllOpsApps();
  const report = await appHealthReport(app, {
    activeAppCount: fleet.apps.filter((a) => a.status === 'active').length || 1,
  });
  return c.json(report);
});

/**
 * GET /api/ops/router — what is actually in place, without changing any of it.
 *
 * Read-only by construction (see routerStatus). Separate from the provision call
 * so "show me the state" can be used for evidence without a write, and so a
 * confused operator cannot reconfigure production by refreshing a page.
 */
ops.get('/router', async (c) => {
  return c.json(await routerStatus());
});

/**
 * POST /api/ops/router/provision — U2.2: deploy the router and wire the hostname.
 *
 * POST because it writes to Cloudflare (script upload, DNS record, Workers route).
 * It is idempotent, so re-running it after fixing a token scope is the intended
 * workflow rather than a risk.
 *
 * 200 whether or not every step succeeded: the REQUEST worked and the step report
 * is the answer. A missing token scope is a founder action, not an HTTP error —
 * and a thrown status would hide the very steps the founder needs to read.
 */
ops.post('/router/provision', async (c) => {
  const principal = c.get('opsPrincipal');
  logger.warn({ userId: principal.userId }, 'ops_router_provision_started');
  const report = await provisionRouter();
  logger.warn(
    { userId: principal.userId, provisioned: report.provisioned, blockedOnDns: report.blockedOnDns },
    'ops_router_provision_finished',
  );
  return c.json(report);
});

/**
 * POST /api/ops/e2e?confirm=RUN-E2E — U2.8, the whole loop on the real substrate.
 *
 * POST and an explicit confirm token: it writes to production R2, KV and Postgres,
 * so no link, prefetch or crawler may be able to start it. Names are always
 * `e2e-<random>` and project_id is null, so it cannot touch a builder's app.
 *
 * 200 whether or not it passed — the report is the answer, and a failing step is
 * data the founder needs to read, not an HTTP error that hides it.
 */
ops.post('/e2e', async (c) => {
  const principal = c.get('opsPrincipal');
  if (c.req.query('confirm') !== E2E_CONFIRM) {
    return c.json(
      { error: 'confirm_required', message: `Dieser Lauf schreibt auf die echte Infrastruktur. Zum Starten: ?confirm=${E2E_CONFIRM}` },
      400,
    );
  }
  const loopsParam = Number(c.req.query('loops'));
  logger.warn({ userId: principal.userId }, 'ops_e2e_started');

  const report = await runOpsE2E({
    userId: principal.userId,
    actor: principal.email,
    ...(Number.isFinite(loopsParam) ? { loops: loopsParam } : {}),
  });

  logger.warn({ userId: principal.userId, passed: report.passed, numbers: report.numbers }, 'ops_e2e_finished');
  return c.json(report);
});

export { ops };
