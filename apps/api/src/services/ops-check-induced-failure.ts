/**
 * AKT 2 · PHASE 5 · U5.6 — the induced-failure harness.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS, AND WHAT IT IS NOT.
 *
 * It is a reproducible way to break a thing on purpose and watch the state change,
 * driving the SHIPPED code: `runCheckTick` from ops-check-runner.ts and
 * `deriveState` from ops-check-state.ts, unmodified. Only two things are replaced,
 * and both are sockets rather than logic:
 *
 *   • the HTTP transport, so the request goes to a local server this file can
 *     break at will instead of to a real Living App;
 *   • the storage, so the rows land in an array instead of Supabase.
 *
 * The URL construction, the status classification, the transport-failure
 * classification, the debounce, the freshness rule and the derivation are all the
 * real ones. A harness that re-implemented any of them could pass while the
 * shipped code failed, which would make it evidence of nothing.
 *
 * IT IS NOT PROOF ABOUT PRODUCTION. It proves the mechanism reacts as designed. It
 * says nothing about whether Cloudflare, the router, KV or R2 behave as expected —
 * that is the founder window's job (Teil C), and this harness is what makes that
 * step a defined procedure instead of an improvisation.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { deriveState, freshnessMsFor, type CheckState } from './ops-check-state';
import { runCheckTick } from './ops-check-runner';
import { subjectCacheKey, type CheckMeasurement } from './ops-checks-store';
import type { OpsApp } from './ops-apps-store';

/** How the served app behaves right now. Flipped by the harness mid-run. */
export type ServedBehaviour = 'ok' | 'broken';

export interface CycleObservation {
  cycle: number;
  behaviour: ServedBehaviour;
  state: CheckState;
  reason: string;
  measuredAt: string | null;
}

export interface InducedFailureRun {
  run: number;
  /** Ticks from the break until the state stopped being `healthy`. */
  cyclesToFirstSignal: number | null;
  /** Ticks from the break until the state reached `down`. */
  cyclesToDown: number | null;
  /** Ticks from the repair until the state returned to `healthy`. */
  cyclesToRecover: number | null;
  observations: CycleObservation[];
}

export interface UnknownPathResult {
  /** State while the runner was ticking normally. */
  whileRunning: CheckState;
  /** State after the runner was PAUSED and the freshness threshold passed. */
  whilePaused: CheckState;
  pausedReason: string;
  /** The timestamp is still reported while paused — a gap is dated, not blank. */
  pausedMeasuredAt: string | null;
  /** State once ticking resumed. */
  afterResume: CheckState;
}

export interface InducedFailureReport {
  cadenceMinutes: number;
  freshnessMs: number;
  runs: InducedFailureRun[];
  unknownPath: UnknownPathResult;
  /** Every run agreed on the same cycle counts. */
  consistent: boolean;
  summary: {
    cyclesToFirstSignal: number[];
    cyclesToDown: number[];
    cyclesToRecover: number[];
  };
}

const APP: OpsApp = {
  appId: 'induced-failure-app',
  userId: 'harness',
  projectId: null,
  appName: 'testapp',
  status: 'active',
  capsProfile: 'free-static',
  r2Prefix: 'apps/induced-failure-app/',
  routeKey: 'route:testapp',
  workerScriptName: null,
  d1DatabaseId: null,
  lastPublishedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const DOMAIN = 'justgoblin.app';
const CADENCE_MINUTES = 5;

/** A local server that answers 200 or 503 depending on a flag this file owns. */
async function startServer(state: { behaviour: ServedBehaviour }): Promise<{ server: Server; port: number }> {
  const server = createServer((_req, res) => {
    if (state.behaviour === 'ok') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>ok</title>');
      return;
    }
    // A broken app that still ANSWERS. This is the realistic shape of the failure
    // the phase is about — a deleted asset, a bad deploy, a suspended origin —
    // and it is a measured `fail`, distinct from a transport failure.
    res.writeHead(503, { 'content-type': 'text/plain' });
    res.end('broken on purpose');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: (server.address() as AddressInfo).port };
}

/**
 * Run the whole proof: three break/repair runs plus the UNKNOWN path.
 *
 * Deterministic and offline — no Cloudflare, no Supabase, no `anmeldeformular`,
 * nothing outside this process.
 */
export async function runInducedFailureProof(opts: { runs?: number; startAt?: number } = {}): Promise<InducedFailureReport> {
  const runCount = opts.runs ?? 3;
  const served = { behaviour: 'ok' as ServedBehaviour };
  const { server, port } = await startServer(served);

  // The transport, and ONLY the transport, is redirected. The runner still builds
  // `https://testapp.justgoblin.app/` through the shipped `appUrl`, so the URL
  // construction stays under test.
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    return await fetch(`http://127.0.0.1:${port}${url.pathname}`, init);
  }) as unknown as typeof fetch;

  const rows: CheckMeasurement[] = [];
  let now = opts.startAt ?? Date.parse('2026-08-14T12:00:00.000Z');
  const freshnessMs = freshnessMsFor('entry', CADENCE_MINUTES);

  const deps = {
    now: () => now,
    fetcher,
    appsDomain: DOMAIN,
    // Platform subjects are not what this proof is about, and letting them reach
    // the real internet would make the run non-deterministic.
    webUrl: null,
    apiUrl: null,
    cert: async () => ({ outcome: 'ok' as const, daysRemaining: 80 }),
    domain: async () => ({ outcome: 'ok' as const, daysRemaining: 300 }),
    listApps: async () => ({ available: true, apps: [APP] }),
    lastMeasured: async () => {
      const last = new Map<string, string>();
      for (const r of [...rows].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))) {
        const key = subjectCacheKey(r.appId, r.subjectKey);
        if (!last.has(key)) last.set(key, r.measuredAt);
      }
      return { available: true, last };
    },
    record: async (m: CheckMeasurement[]) => {
      rows.push(...m);
      return true;
    },
    prune: async () => ({ ok: true as const, cutoff: new Date(now - 8 * 86_400_000).toISOString() }),
  };

  /** The state as any surface would derive it right now, from the stored rows. */
  const currentState = () =>
    deriveState(
      rows.filter((r) => r.appId === APP.appId && r.subjectKey === 'entry'),
      { now, freshnessMs },
    );

  /** One cycle: advance the clock by the cadence, tick, then read the state. */
  async function cycle(observations: CycleObservation[], index: number): Promise<CycleObservation> {
    now += CADENCE_MINUTES * 60_000;
    await runCheckTick(deps);
    const d = currentState();
    const obs: CycleObservation = {
      cycle: index,
      behaviour: served.behaviour,
      state: d.state,
      reason: d.reason,
      measuredAt: d.measuredAt,
    };
    observations.push(obs);
    return obs;
  }

  const runs: InducedFailureRun[] = [];

  try {
    for (let run = 1; run <= runCount; run += 1) {
      // Each run starts from a clean history, so run 2 cannot inherit run 1's
      // rows and reach `down` faster than it earned.
      rows.length = 0;
      served.behaviour = 'ok';
      const observations: CycleObservation[] = [];
      let index = 0;

      // 1. Establish healthy. Two cycles, because that is what the debounce needs.
      while (index < 4 && currentState().state !== 'healthy') {
        index += 1;
        await cycle(observations, index);
      }

      // 2. Break it, and count.
      served.behaviour = 'broken';
      let cyclesToFirstSignal: number | null = null;
      let cyclesToDown: number | null = null;
      for (let i = 1; i <= 6 && cyclesToDown === null; i += 1) {
        index += 1;
        const obs = await cycle(observations, index);
        if (cyclesToFirstSignal === null && obs.state !== 'healthy') cyclesToFirstSignal = i;
        if (obs.state === 'down') cyclesToDown = i;
      }

      // 3. Repair it, and count again.
      served.behaviour = 'ok';
      let cyclesToRecover: number | null = null;
      for (let i = 1; i <= 6 && cyclesToRecover === null; i += 1) {
        index += 1;
        const obs = await cycle(observations, index);
        if (obs.state === 'healthy') cyclesToRecover = i;
      }

      runs.push({ run, cyclesToFirstSignal, cyclesToDown, cyclesToRecover, observations });
    }

    // ── The UNKNOWN path: pause the runner and watch the card refuse to stay green.
    rows.length = 0;
    served.behaviour = 'ok';
    const obs: CycleObservation[] = [];
    await cycle(obs, 1);
    await cycle(obs, 2);
    const whileRunning = currentState();

    // Nothing ticks. Time passes. This is a redeploy, a crash, a kill switch —
    // every way the instrument can stop looking.
    now += freshnessMs + 60_000;
    const paused = currentState();

    // Resume.
    await cycle(obs, 3);
    await cycle(obs, 4);
    const afterResume = currentState();

    const summary = {
      cyclesToFirstSignal: runs.map((r) => r.cyclesToFirstSignal ?? -1),
      cyclesToDown: runs.map((r) => r.cyclesToDown ?? -1),
      cyclesToRecover: runs.map((r) => r.cyclesToRecover ?? -1),
    };
    const allSame = (xs: number[]) => xs.every((x) => x === xs[0]);

    return {
      cadenceMinutes: CADENCE_MINUTES,
      freshnessMs,
      runs,
      unknownPath: {
        whileRunning: whileRunning.state,
        whilePaused: paused.state,
        pausedReason: paused.reason,
        pausedMeasuredAt: paused.measuredAt,
        afterResume: afterResume.state,
      },
      consistent:
        allSame(summary.cyclesToFirstSignal) && allSame(summary.cyclesToDown) && allSame(summary.cyclesToRecover),
      summary,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
