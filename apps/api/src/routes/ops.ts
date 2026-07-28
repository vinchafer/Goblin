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
import logger from '../lib/logger';

type Variables = OpsGateVariables;

const ops = new Hono<{ Variables: Variables }>();

ops.use('*', opsGate);

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

export { ops };
