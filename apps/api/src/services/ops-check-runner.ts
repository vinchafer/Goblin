/**
 * AKT 2 · PHASE 5 · U5.1 / U5.5 — the check runner: one tick, many subjects.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC BY DEFINITION. Nothing here calls a model. There is no prompt, no
 * token, no `completion_costs` row, and no branch that could grow one — K0's whole
 * economic argument (ledger M-K1) is that knowing whether an app is up costs an
 * HTTP request and nothing else. If a future edit needs an inference call to answer
 * "is it up", that is a design smell to escalate, not a feature to add.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── The fan-out shape (spike finding F2) ────────────────────────────────────────
 * ONE tick iterates the app list from the platform database. There is no cron
 * trigger per app — and on Workers FREE the account ceiling is FIVE triggers, so
 * that design would break at five apps. This phase uses ZERO: the loop lives in the
 * Railway process. See ops-check-budget.ts and docs/ACT2_PHASE5_DECISIONS.md §P5-a.
 *
 * ── What "degrade honestly" means here, concretely ──────────────────────────────
 * An app that could not be checked gets an `unknown` ROW — written, not skipped and
 * not carried forward. This is the single most important line in the file:
 *
 *   • Skipping it would leave the app's previous `ok` as the newest row, and the
 *     derivation would go on reporting a green that nobody measured until the
 *     freshness threshold expired.
 *   • Recording the previous state would be interpolation — a claim about now made
 *     out of a fact about then.
 *
 * So a timeout writes "we could not tell", with the time we could not tell it at.
 *
 * ── Why the whole tick is written in ONE batch ──────────────────────────────────
 * A partial write leaves some subjects with a newest row from this tick and others
 * without, and the derivation reads the difference as a gap that did not happen. If
 * the write fails, NOTHING from the tick is recorded and the next derivation sees
 * an honest gap instead of a half-tick.
 *
 * ── Everything is injectable ────────────────────────────────────────────────────
 * `RunnerDeps` exists so the induced-failure harness (U5.6) drives the REAL runner
 * against a controllable server and a real clock it can advance — rather than a
 * re-implementation that could pass while the shipped code fails.
 */

import { setTimeout as sleep } from 'node:timers/promises';
import tls from 'node:tls';
import { listAllOpsApps, type OpsApp } from './ops-apps-store';
import { appUrl, appHostname } from './ops-app-names';
import { opsAppsDomain, queryD1 } from './cf-deploy';
import { opsHostingEnabled } from './ops-beta';
import { formsEndpoint } from './ops-form-wiring';
import { envFlag, envString } from '../lib/env-value';
import {
  lastMeasuredAtBySubject,
  pruneOldChecks,
  recordChecks,
  subjectCacheKey,
  type CheckMeasurement,
  type CheckSubjectKey,
} from './ops-checks-store';
import { cadenceFor, type CadencePlan } from './ops-check-budget';
import { expiryOutcome, type CheckOutcome } from './ops-check-state';
import logger from '../lib/logger';

/** Its own switch, ANDed with the Act-2 kill switch. Default ON when hosting is on. */
export const OPS_CHECKS_ENABLED_ENV = 'OPS_CHECKS_ENABLED';

/** Per-call ceiling. Beyond this we do not know, and we say so rather than wait. */
export const PROBE_TIMEOUT_MS = 10_000;

/** How often the scheduler wakes to ask "what is due?" — not how often anything is checked. */
export const WAKE_INTERVAL_MS = 60_000;

/**
 * How often each subject is measured, as a minimum interval between rows.
 *
 * `null` means "the fleet cadence" (ops-check-budget.ts), which moves with the
 * number of apps. The two fixed ones move far more slowly than anything else here:
 * a certificate's expiry date changes about four times a year and a domain's once,
 * so measuring either every five minutes would be 288 handshakes a day for a number
 * that does not move — cost with no information.
 */
export const SUBJECT_MIN_INTERVAL_MS: Record<CheckSubjectKey, number | null> = {
  entry: null,
  form_store: null,
  web: null,
  api: null,
  cert: 60 * 60_000,
  domain: 12 * 60 * 60_000,
};

/** Is the heartbeat armed? Its own switch, ANDed with the Act-2 kill switch. */
export function checksEnabled(): boolean {
  if (!opsHostingEnabled()) return false;
  // Default ON: an explicit `false` disarms, anything else (including unset) leaves
  // it armed. The reverse default would mean a merge that ships a heartbeat which
  // silently does not beat, which is the failure this phase is least allowed to have.
  const raw = envString(OPS_CHECKS_ENABLED_ENV);
  if (raw === '') return true;
  return envFlag(OPS_CHECKS_ENABLED_ENV);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export interface ProbeResult {
  outcome: CheckOutcome;
  httpStatus?: number | null;
  latencyMs?: number | null;
  daysRemaining?: number | null;
  detail?: string | null;
}

/**
 * Classify a transport failure as measured (`fail`) or inconclusive (`unknown`).
 *
 * THIS FUNCTION IS THE LINE between "the app is broken" and "we could not tell",
 * and it is drawn by asking one question: could this outcome be OUR fault?
 *
 *   • A refused connection, a hostname that does not exist, a rejected certificate
 *     — the network gave a definitive answer about the app. That is a measurement.
 *   • A timeout, an abort, a temporary resolver failure — our egress, our DNS, our
 *     process under load would all look exactly like this. Claiming the app is down
 *     on that evidence is a claim we have not earned.
 *
 * The asymmetry is deliberate and it costs us: a genuinely dead app whose DNS is
 * merely slow reads as UNKNOWN rather than down. That is the direction this
 * codebase errs in, and the operator view surfaces UNKNOWN prominently for exactly
 * that reason (U5.4).
 */
export function classifyTransportFailure(err: unknown): { outcome: 'fail' | 'unknown'; detail: string } {
  const e = err as { name?: string; code?: string; cause?: { code?: string; name?: string } } | undefined;
  const name = String(e?.name ?? e?.cause?.name ?? '');
  const code = String(e?.code ?? e?.cause?.code ?? '');

  // Ambiguous — could equally be us.
  if (/AbortError|TimeoutError/i.test(name) || /ABORT_ERR|ETIMEDOUT|EAI_AGAIN|ECONNABORTED/i.test(code)) {
    return { outcome: 'unknown', detail: 'timeout' };
  }
  // Definitive answers from the network about the far end.
  if (/ENOTFOUND|EAI_NONAME/i.test(code)) return { outcome: 'fail', detail: 'dns_nxdomain' };
  if (/ECONNREFUSED/i.test(code)) return { outcome: 'fail', detail: 'refused' };
  if (/ECONNRESET|EPIPE/i.test(code)) return { outcome: 'fail', detail: 'reset' };
  if (/^(CERT_|UNABLE_TO_|DEPTH_ZERO|SELF_SIGNED|ERR_TLS)/i.test(code)) return { outcome: 'fail', detail: 'tls' };

  // Anything unrecognised is UNKNOWN, never fail. An error class we have not seen
  // before is not evidence about somebody's app.
  return { outcome: 'unknown', detail: `unclassified:${(code || name || 'error').slice(0, 40)}` };
}

/** One GET. 200 is ok; any other answer is a measured failure; no answer is classified. */
export async function httpProbe(
  url: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(timeoutMs),
      // `manual` so a redirect is reported as what it is rather than silently
      // followed to somewhere that answers 200 — an app whose entry redirects is
      // not the same app that was published.
      redirect: 'manual',
      headers: { 'User-Agent': 'goblin-keeper/1.0 (+https://justgoblin.com)' },
    });
    return {
      outcome: res.status === 200 ? 'ok' : 'fail',
      httpStatus: res.status,
      latencyMs: Date.now() - started,
      detail: res.status === 200 ? null : `status_${res.status}`,
    };
  } catch (err) {
    const { outcome, detail } = classifyTransportFailure(err);
    return { outcome, httpStatus: null, latencyMs: Date.now() - started, detail };
  }
}

/**
 * The certificate served for a hostname, as days until it expires.
 *
 * A TLS handshake, not an HTTP request: no path is fetched and no Worker is
 * invoked, which is why this does not appear in the router request budget.
 */
export async function certProbe(hostname: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResult> {
  const started = Date.now();
  return await new Promise<ProbeResult>((resolve) => {
    let settled = false;
    const done = (r: ProbeResult) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* the answer is already decided; a failed teardown must not change it */
      }
      resolve({ ...r, latencyMs: Date.now() - started });
    };

    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate();
      const validTo = cert && typeof cert.valid_to === 'string' ? Date.parse(cert.valid_to) : NaN;
      if (!Number.isFinite(validTo)) {
        // A handshake that produced no readable date is UNKNOWN, never ok.
        done({ outcome: 'unknown', daysRemaining: null, detail: 'no_valid_to' });
        return;
      }
      const days = Math.floor((validTo - Date.now()) / 86_400_000);
      done({ outcome: expiryOutcome(days), daysRemaining: days, detail: null });
    });

    socket.on('timeout', () => done({ outcome: 'unknown', daysRemaining: null, detail: 'timeout' }));
    socket.on('error', (err) => {
      const { outcome, detail } = classifyTransportFailure(err);
      done({ outcome, daysRemaining: null, detail });
    });
  });
}

/**
 * When the domain registration expires, via RDAP — the registry's own machine-
 * readable answer, no key and no scraping.
 *
 * Anything unparseable is UNKNOWN. A registration date we could not read is not a
 * registration that is fine, and this is the check with the longest lead time and
 * the most permanent consequence if it is wrong.
 */
export async function domainProbe(
  registrableDomain: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetcher(`https://rdap.org/domain/${encodeURIComponent(registrableDomain)}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/rdap+json', 'User-Agent': 'goblin-keeper/1.0 (+https://justgoblin.com)' },
    });
    if (!res.ok) {
      return { outcome: 'unknown', httpStatus: res.status, latencyMs: Date.now() - started, detail: `rdap_status_${res.status}` };
    }
    const body = (await res.json()) as { events?: Array<{ eventAction?: string; eventDate?: string }> };
    const event = (body.events ?? []).find((e) => e.eventAction === 'expiration');
    const at = event?.eventDate ? Date.parse(event.eventDate) : NaN;
    if (!Number.isFinite(at)) {
      return { outcome: 'unknown', httpStatus: res.status, latencyMs: Date.now() - started, detail: 'no_expiration_event' };
    }
    const days = Math.floor((at - Date.now()) / 86_400_000);
    // A domain is worth shouting about far earlier than a certificate: nothing
    // renews it automatically, and a lapse is not recoverable in minutes.
    return { outcome: expiryOutcome(days, 30), daysRemaining: days, httpStatus: res.status, latencyMs: Date.now() - started, detail: null };
  } catch (err) {
    const { outcome, detail } = classifyTransportFailure(err);
    // Whatever RDAP failure this was, it says nothing about the registration.
    return { outcome: 'unknown', latencyMs: Date.now() - started, detail };
  }
}

/**
 * Can the app's own database still be reached and read?
 *
 * `SELECT 1` — read-only, and deliberately NOT the master plan's "form-echo
 * synthetic". An echo submission would write a row into the table holding OTHER
 * PEOPLE'S personal data on every tick: 288 fake entries a day in a builder's
 * inbox and in the CSV they hand to someone. The read exercises the same chain
 * (token → D1 API → database exists → answers) at none of that price. Deviation
 * from the master plan, deliberate; docs/ACT2_PHASE5_DECISIONS.md §P5-b.
 *
 * An auth or timeout failure is OURS (a revoked token, a slow API) and reads as
 * `unknown`; a database that answers "no such thing" is a measured failure.
 */
export async function formStoreProbe(databaseId: string, query: typeof queryD1 = queryD1): Promise<ProbeResult> {
  const started = Date.now();
  const res = await query(databaseId, 'select 1 as ok');
  if (res.ok) return { outcome: 'ok', latencyMs: Date.now() - started, detail: null };
  const code = res.error.code;
  const ours = code === 'auth' || code === 'timeout' || code === 'rate_limited' || code === 'not_configured';
  return {
    outcome: ours ? 'unknown' : 'fail',
    latencyMs: Date.now() - started,
    // The adapter's code, never its message: an upstream body can quote values.
    detail: `d1_${code}`,
  };
}

// ── The tick ────────────────────────────────────────────────────────────────

export interface RunnerDeps {
  now?: () => number;
  fetcher?: typeof fetch;
  listApps?: typeof listAllOpsApps;
  d1Query?: typeof queryD1;
  cert?: (hostname: string) => Promise<ProbeResult>;
  domain?: (domain: string) => Promise<ProbeResult>;
  record?: typeof recordChecks;
  lastMeasured?: typeof lastMeasuredAtBySubject;
  prune?: typeof pruneOldChecks;
  /** Overrides for the platform subjects, so a harness need not own DNS. */
  webUrl?: string | null;
  apiUrl?: string | null;
  appsDomain?: string;
}

export interface TickReport {
  ran: boolean;
  /** Why nothing ran, when nothing ran. */
  skipped?: 'disabled' | 'store_unavailable' | 'nothing_due';
  cadence: CadencePlan;
  activeApps: number;
  /** Measurements taken this tick, by outcome. Counts, never contents. */
  measured: { ok: number; warn: number; fail: number; unknown: number };
  /** False when the batch could not be written — nothing was recorded at all. */
  recorded: boolean;
  prunedBefore: string | null;
  tookMs: number;
  at: string;
}

/** The registrable domain of a hostname: `justgoblin.app` from `x.justgoblin.app`. */
export function registrableDomainOf(domain: string): string {
  const parts = domain.split('.').filter(Boolean);
  return parts.length <= 2 ? domain : parts.slice(-2).join('.');
}

/** Is a subject due, given when it was last measured? Restart-proof: no counters. */
function isDue(lastIso: string | undefined, minIntervalMs: number, now: number): boolean {
  if (!lastIso) return true;
  const t = Date.parse(lastIso);
  if (!Number.isFinite(t)) return true;
  return now - t >= minIntervalMs;
}

/**
 * Run ONE tick: work out what is due, measure it, write the batch, prune.
 *
 * Never throws. A tick that could not do its job reports that it could not, because
 * a scheduler that dies on the first bad night is worse than no scheduler.
 */
export async function runCheckTick(deps: RunnerDeps = {}): Promise<TickReport> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const fetcher = deps.fetcher ?? fetch;
  const record = deps.record ?? recordChecks;
  const listApps = deps.listApps ?? listAllOpsApps;
  const lastMeasured = deps.lastMeasured ?? lastMeasuredAtBySubject;
  const prune = deps.prune ?? pruneOldChecks;
  const domain = deps.appsDomain ?? opsAppsDomain();

  const empty = { ok: 0, warn: 0, fail: 0, unknown: 0 };
  const base = (extra: Partial<TickReport>): TickReport => ({
    ran: false,
    cadence: cadenceFor(0),
    activeApps: 0,
    measured: { ...empty },
    recorded: false,
    prunedBefore: null,
    tookMs: now() - startedAt,
    at: new Date(startedAt).toISOString(),
    ...extra,
  });

  if (!checksEnabled()) return base({ skipped: 'disabled' });

  const { available, apps } = await listApps();
  // A registry we could not read is not an empty fleet. Making requests would be
  // pointless and recording rows for apps we cannot enumerate is impossible, so the
  // tick stops — and the absence of rows becomes the honest UNKNOWN downstream.
  if (!available) return base({ skipped: 'store_unavailable' });

  // Only apps that are actually serving. A suspended app is SUPPOSED to answer with
  // the suspension page, so checking it would record a permanent failure for a
  // deliberate state; a failed or torn-down app has nothing to check.
  const active = apps.filter((a: OpsApp) => a.status === 'active');
  const cadence = cadenceFor(active.length);
  const cadenceMs = cadence.cadenceMinutes * 60_000;

  const dueMap = await lastMeasured();
  if (!dueMap.available) return base({ cadence, activeApps: active.length, skipped: 'store_unavailable' });

  const minInterval = (key: CheckSubjectKey) => SUBJECT_MIN_INTERVAL_MS[key] ?? cadenceMs;
  const due = (appId: string | null, key: CheckSubjectKey) =>
    isDue(dueMap.last.get(subjectCacheKey(appId, key)), minInterval(key), startedAt);

  const measurements: CheckMeasurement[] = [];
  const at = () => new Date(now()).toISOString();
  const push = (appId: string | null, subjectKey: CheckSubjectKey, r: ProbeResult) => {
    measurements.push({
      appId,
      subjectKey,
      outcome: r.outcome,
      httpStatus: r.httpStatus ?? null,
      latencyMs: r.latencyMs ?? null,
      daysRemaining: r.daysRemaining ?? null,
      detail: r.detail ?? null,
      measuredAt: at(),
    });
  };

  /**
   * Run one probe and record SOMETHING, whatever happens.
   *
   * None of the shipped probes throws — each catches and returns a verdict. This
   * wrapper exists so that property is a guarantee of the tick rather than a
   * coincidence of the four probes that happen to live here today: a probe that
   * throws would otherwise take the whole batch down with it, and the apps already
   * measured in this tick would lose their rows to somebody else's bug.
   *
   * A thrown probe is recorded as `unknown` — the same answer as a timeout, for
   * the same reason. Our code failing is not evidence about somebody's app.
   */
  const probe = async (appId: string | null, subjectKey: CheckSubjectKey, fn: () => Promise<ProbeResult>) => {
    try {
      push(appId, subjectKey, await fn());
    } catch (err) {
      logger.warn({ appId, subjectKey, reason: (err as Error)?.message }, 'ops_check_probe_threw');
      push(appId, subjectKey, { outcome: 'unknown', detail: 'probe_error' });
    }
  };

  // ── Per-app subjects ──────────────────────────────────────────────────────
  // Sequential rather than parallel: this is a background job with all the time in
  // the world, and a fan-out that opens N simultaneous connections is a fan-out
  // that looks like a burst to the very rate limiter we installed in Phase 4.
  for (const app of active) {
    if (domain && due(app.appId, 'entry')) {
      await probe(app.appId, 'entry', () => httpProbe(appUrl(app.appName, domain), fetcher));
    }
    if (app.d1DatabaseId && due(app.appId, 'form_store')) {
      const databaseId = app.d1DatabaseId;
      await probe(app.appId, 'form_store', () => formStoreProbe(databaseId, deps.d1Query ?? queryD1));
    }
  }

  // ── Platform subjects (U5.5) — the same instrument, the same derivation ───
  // Goblin's own surfaces are rows in the same table, read by the same state
  // machine, rendered by the same components. That is what "one instrument" means:
  // not a second dashboard that happens to look similar.
  const webUrl = deps.webUrl !== undefined ? deps.webUrl : envString('NEXT_PUBLIC_APP_URL') || 'https://justgoblin.com';
  if (webUrl && due(null, 'web')) await probe(null, 'web', () => httpProbe(webUrl, fetcher));

  // The API's own PUBLIC address. This proves DNS, the proxy and the process are
  // reachable from outside — and nothing about the API's internal dependencies.
  // Weaker than it looks (the runner lives in that process), and stated as such.
  // `formsEndpoint()` answers '' rather than throwing when the value is unset or
  // malformed — and '' means the probe simply does not run, which leaves an honest
  // gap rather than a row about a URL we made up.
  const apiOrigin = deps.apiUrl !== undefined ? deps.apiUrl : formsEndpoint();
  if (apiOrigin && due(null, 'api')) {
    await probe(null, 'api', () => httpProbe(`${apiOrigin.replace(/\/$/, '')}/health`, fetcher));
  }

  // ONE certificate and ONE registration for the whole zone — measured once, shown
  // for every app. Per-app probes would be the same fact N times: no information,
  // N times the cost, and N cards going red together looking like N incidents.
  if (domain && due(null, 'cert')) {
    // SNI needs a name that resolves under the wildcard; the apex is not covered by
    // it. The alphabetically first active app is a deterministic choice, so two
    // ticks pick the same host and the reading is comparable.
    const probeHost = [...active].map((a) => a.appName).sort()[0];
    if (probeHost) {
      const certProbeFn = deps.cert ?? ((h: string) => certProbe(h));
      await probe(null, 'cert', () => certProbeFn(appHostname(probeHost, domain)));
    } else {
      // No app to borrow a hostname from. NOT measured — and recorded as not
      // measured, rather than skipped into a silence that reads as fine.
      push(null, 'cert', { outcome: 'unknown', daysRemaining: null, detail: 'no_active_app' });
    }
  }
  if (domain && due(null, 'domain')) {
    const domainProbeFn = deps.domain ?? ((d: string) => domainProbe(d, fetcher));
    await probe(null, 'domain', () => domainProbeFn(registrableDomainOf(domain)));
  }

  const measured = { ...empty };
  for (const m of measurements) measured[m.outcome] += 1;

  if (measurements.length === 0) {
    return base({ cadence, activeApps: active.length, skipped: 'nothing_due', recorded: true });
  }

  const recorded = await record(measurements);
  if (!recorded) {
    // Requests were spent and nothing was written. Loud, because the next tick will
    // spend them again — and because the surfaces will show UNKNOWN while the apps
    // may be perfectly fine, which is the confusing-but-honest state.
    logger.warn({ count: measurements.length }, 'ops_check_tick_not_recorded');
  }

  // Retention lives in the tick (P5-e): a cleanup with its own trigger is a cleanup
  // that eventually stops running.
  const pruned = await prune({ now: startedAt });

  logger.info(
    { apps: active.length, cadence: cadence.cadenceMinutes, measured, recorded, overBudget: cadence.overBudget },
    'ops_check_tick',
  );

  return {
    ran: true,
    cadence,
    activeApps: active.length,
    measured,
    recorded,
    prunedBefore: pruned?.cutoff ?? null,
    tookMs: now() - startedAt,
    at: new Date(startedAt).toISOString(),
  };
}

// ── The scheduler ───────────────────────────────────────────────────────────

let running = false;
let stopRequested = false;

/** The last tick this process completed — read-only, for the console. */
let lastTick: TickReport | null = null;
export function lastCheckTick(): TickReport | null {
  return lastTick;
}

/**
 * Start the in-process scheduler.
 *
 * It wakes every minute and asks what is DUE — it does not itself run at the check
 * cadence. Due-ness is computed from the newest stored row per subject, so a
 * restart cannot double-check anything and cannot skip anything: the database, not
 * a counter in memory, remembers when we last looked.
 *
 * ── The honest limitation, stated where it lives ────────────────────────────
 * With more than one Railway instance, every instance runs this loop. The true
 * request volume is (instances × the formula in ops-check-budget.ts) and duplicate
 * rows appear for the same subject. Same class of problem as the in-process form
 * rate limiter (carry-forward P3), handled the same way: named, budgeted for, and
 * left for the day the API actually runs more than one instance — a lease nobody
 * needs yet is a second thing to get wrong.
 */
export function startCheckRunner(deps: RunnerDeps = {}): () => void {
  if (running) return () => undefined;
  running = true;
  stopRequested = false;

  void (async () => {
    logger.info({ wakeMs: WAKE_INTERVAL_MS }, 'ops_check_runner_started');
    while (!stopRequested) {
      try {
        lastTick = await runCheckTick(deps);
      } catch (err) {
        // A tick that threw is a bug, not a reason to stop watching the fleet.
        logger.warn({ reason: (err as Error)?.message }, 'ops_check_tick_threw');
      }
      await sleep(WAKE_INTERVAL_MS);
    }
    running = false;
    logger.info({}, 'ops_check_runner_stopped');
  })();

  return () => {
    stopRequested = true;
  };
}
