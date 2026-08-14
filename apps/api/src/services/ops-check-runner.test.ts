/**
 * AKT 2 · PHASE 5 · U5.1 — the runner's tests.
 *
 * The property under test throughout: an app that could not be checked gets an
 * `unknown` ROW, never a carried-forward previous state and never a silence. Every
 * case below that involves a failure asks the same question — what got WRITTEN.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classifyTransportFailure,
  formStoreProbe,
  httpProbe,
  registrableDomainOf,
  runCheckTick,
  checksEnabled,
  type ProbeResult,
} from './ops-check-runner';
import type { CheckMeasurement } from './ops-checks-store';
import type { OpsApp } from './ops-apps-store';

const NOW = Date.parse('2026-08-14T12:00:00.000Z');

function app(over: Partial<OpsApp> = {}): OpsApp {
  return {
    appId: 'a1',
    userId: 'u1',
    projectId: 'p1',
    appName: 'meine-app',
    status: 'active',
    capsProfile: 'free-static',
    r2Prefix: 'apps/a1/',
    routeKey: 'route:meine-app',
    workerScriptName: null,
    d1DatabaseId: null,
    lastPublishedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

/** Collects what the tick wrote, so every assertion is about recorded rows. */
function harness(over: Parameters<typeof runCheckTick>[0] = {}) {
  const written: CheckMeasurement[] = [];
  return {
    written,
    deps: {
      now: () => NOW,
      appsDomain: 'justgoblin.app',
      webUrl: null,
      apiUrl: null,
      listApps: async () => ({ available: true, apps: [app()] }),
      lastMeasured: async () => ({ available: true, last: new Map<string, string>() }),
      record: async (m: CheckMeasurement[]) => {
        written.push(...m);
        return true;
      },
      prune: async () => ({ ok: true as const, cutoff: '2026-08-06T12:00:00.000Z' }),
      cert: async (): Promise<ProbeResult> => ({ outcome: 'ok', daysRemaining: 80 }),
      domain: async (): Promise<ProbeResult> => ({ outcome: 'ok', daysRemaining: 300 }),
      fetcher: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      ...over,
    } satisfies Parameters<typeof runCheckTick>[0],
  };
}

beforeEach(() => {
  process.env.OPS_HOSTING_ENABLED = 'true';
  delete process.env.OPS_CHECKS_ENABLED;
});
afterEach(() => {
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_CHECKS_ENABLED;
  vi.restoreAllMocks();
});

describe('classifyTransportFailure — the line between "broken" and "we could not tell"', () => {
  it('a timeout is UNKNOWN, because it could equally be us', () => {
    expect(classifyTransportFailure({ name: 'TimeoutError' }).outcome).toBe('unknown');
    expect(classifyTransportFailure({ name: 'AbortError' }).outcome).toBe('unknown');
    expect(classifyTransportFailure({ code: 'ETIMEDOUT' }).outcome).toBe('unknown');
  });

  it('a temporary resolver failure is UNKNOWN — that is our DNS, not their app', () => {
    expect(classifyTransportFailure({ code: 'EAI_AGAIN' }).outcome).toBe('unknown');
  });

  it('a definitive network answer is a MEASUREMENT and reads as fail', () => {
    expect(classifyTransportFailure({ code: 'ENOTFOUND' }).outcome).toBe('fail');
    expect(classifyTransportFailure({ code: 'ECONNREFUSED' }).outcome).toBe('fail');
    expect(classifyTransportFailure({ code: 'CERT_HAS_EXPIRED' }).outcome).toBe('fail');
  });

  it('an error class nobody has seen before is UNKNOWN, never fail', () => {
    expect(classifyTransportFailure({ code: 'ESOMETHINGNEW' }).outcome).toBe('unknown');
    expect(classifyTransportFailure(undefined).outcome).toBe('unknown');
  });

  it('reads the code off a wrapped cause, which is where undici puts it', () => {
    expect(classifyTransportFailure({ name: 'TypeError', cause: { code: 'ECONNREFUSED' } }).outcome).toBe('fail');
  });
});

describe('httpProbe', () => {
  const fetcherFor = (status: number) => (async () => new Response('', { status })) as unknown as typeof fetch;

  it('200 is ok', async () => {
    const r = await httpProbe('https://x.test/', fetcherFor(200));
    expect(r.outcome).toBe('ok');
    expect(r.httpStatus).toBe(200);
    expect(typeof r.latencyMs).toBe('number');
  });

  it.each([404, 410, 429, 500, 503])('%i is a measured failure and keeps its status', async (status) => {
    const r = await httpProbe('https://x.test/', fetcherFor(status));
    expect(r.outcome).toBe('fail');
    expect(r.httpStatus).toBe(status);
    expect(r.detail).toBe(`status_${status}`);
  });

  it('a redirect is a failure, not a followed success — a redirected entry is not the app', async () => {
    const r = await httpProbe('https://x.test/', fetcherFor(302));
    expect(r.outcome).toBe('fail');
  });

  it('a timeout produces UNKNOWN with a null status — never 0, which would read as a status', async () => {
    const boom = (async () => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    }) as unknown as typeof fetch;
    const r = await httpProbe('https://x.test/', boom);
    expect(r.outcome).toBe('unknown');
    expect(r.httpStatus).toBeNull();
  });
});

describe('formStoreProbe — read-only, and never a synthetic submission', () => {
  it('sends a SELECT and no write', async () => {
    const seen: string[] = [];
    const query = (async (_id: string, sql: string) => {
      seen.push(sql);
      return { ok: true as const, value: { rows: [], rowsRead: 1, rowsWritten: 0, durationMs: 1 } };
    }) as never;
    const r = await formStoreProbe('db1', query);
    expect(r.outcome).toBe('ok');
    expect(seen).toHaveLength(1);
    // The whole point of P5-b: nothing here may write into the table that holds
    // other people's personal data.
    expect(seen[0]).toMatch(/^select /i);
    expect(seen[0]).not.toMatch(/insert|update|delete/i);
  });

  it('an auth or timeout failure is OURS and reads as unknown', async () => {
    for (const code of ['auth', 'timeout', 'rate_limited', 'not_configured']) {
      const query = (async () => ({ ok: false as const, error: { code, message: 'x' } })) as never;
      expect((await formStoreProbe('db1', query)).outcome).toBe('unknown');
    }
  });

  it('a database that answers "no such thing" is a measured failure', async () => {
    const query = (async () => ({ ok: false as const, error: { code: 'not_found', message: 'x' } })) as never;
    expect((await formStoreProbe('db1', query)).outcome).toBe('fail');
  });

  it('carries the adapter code and never the upstream message', async () => {
    const query = (async () => ({ ok: false as const, error: { code: 'upstream', message: 'row value: hallo@example.com' } })) as never;
    const r = await formStoreProbe('db1', query);
    expect(r.detail).toBe('d1_upstream');
    expect(r.detail).not.toContain('example.com');
  });
});

describe('runCheckTick — the gates', () => {
  it('does nothing when the Act-2 kill switch is off', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    const h = harness();
    const r = await runCheckTick(h.deps);
    expect(r.ran).toBe(false);
    expect(r.skipped).toBe('disabled');
    expect(h.written).toEqual([]);
  });

  it('does nothing when its own switch is explicitly off — but is ARMED by default', async () => {
    process.env.OPS_CHECKS_ENABLED = 'false';
    expect(checksEnabled()).toBe(false);
    expect((await runCheckTick(harness().deps)).skipped).toBe('disabled');

    delete process.env.OPS_CHECKS_ENABLED;
    expect(checksEnabled()).toBe(true);
  });

  it('STOPS when the registry cannot be read — an unreadable registry is not an empty fleet', async () => {
    const h = harness({ listApps: async () => ({ available: false, apps: [] }) });
    const r = await runCheckTick(h.deps);
    expect(r.skipped).toBe('store_unavailable');
    expect(h.written).toEqual([]);
  });

  it('STOPS when the check store cannot be read — no requests spent on rows nobody records', async () => {
    const h = harness({ lastMeasured: async () => ({ available: false, last: new Map() }) });
    const r = await runCheckTick(h.deps);
    expect(r.skipped).toBe('store_unavailable');
    expect(h.written).toEqual([]);
  });

  it('reports recorded:false when the batch could not be written', async () => {
    const h = harness({ record: async () => false });
    const r = await runCheckTick(h.deps);
    expect(r.ran).toBe(true);
    expect(r.recorded).toBe(false);
  });
});

describe('runCheckTick — what gets checked', () => {
  it('checks only ACTIVE apps: a suspended app is answering as designed, not failing', async () => {
    const h = harness({
      listApps: async () => ({
        available: true,
        apps: [
          app({ appId: 'a1', appName: 'live-app' }),
          app({ appId: 'a2', appName: 'gesperrt', status: 'suspended' }),
          app({ appId: 'a3', appName: 'kaputt', status: 'failed' }),
          app({ appId: 'a4', appName: 'weg', status: 'deleted' }),
        ],
      }),
    });
    await runCheckTick(h.deps);
    const entries = h.written.filter((m) => m.subjectKey === 'entry');
    expect(entries.map((m) => m.appId)).toEqual(['a1']);
  });

  it('checks the form store only for apps that have one', async () => {
    const h = harness({
      listApps: async () => ({
        available: true,
        apps: [app({ appId: 'a1' }), app({ appId: 'a2', appName: 'mit-formular', d1DatabaseId: 'db2' })],
      }),
      d1Query: (async () => ({ ok: true as const, value: { rows: [], rowsRead: 1, rowsWritten: 0, durationMs: 1 } })) as never,
    });
    await runCheckTick(h.deps);
    expect(h.written.filter((m) => m.subjectKey === 'form_store').map((m) => m.appId)).toEqual(['a2']);
  });

  it('measures the certificate ONCE for the whole zone, not once per app', async () => {
    const hosts: string[] = [];
    const h = harness({
      listApps: async () => ({
        available: true,
        apps: [app({ appId: 'a1', appName: 'zebra' }), app({ appId: 'a2', appName: 'alpha' }), app({ appId: 'a3', appName: 'mitte' })],
      }),
      cert: async (hostname: string) => {
        hosts.push(hostname);
        return { outcome: 'ok', daysRemaining: 70 };
      },
    });
    await runCheckTick(h.deps);
    const certRows = h.written.filter((m) => m.subjectKey === 'cert');
    expect(certRows).toHaveLength(1);
    // Platform subject: no app id, because it is a fact about the zone.
    expect(certRows[0]?.appId).toBeNull();
    // Deterministic host choice, so two ticks compare like with like.
    expect(hosts).toEqual(['alpha.justgoblin.app']);
  });

  it('records the certificate as UNKNOWN when there is no app to borrow a hostname from', async () => {
    const h = harness({ listApps: async () => ({ available: true, apps: [] }) });
    await runCheckTick(h.deps);
    const cert = h.written.find((m) => m.subjectKey === 'cert');
    // Written, not skipped: a silence would read as fine.
    expect(cert?.outcome).toBe('unknown');
    expect(cert?.detail).toBe('no_active_app');
  });

  it('skips a subject that is not due yet', async () => {
    const h = harness({
      // Checked four minutes ago; the cadence at one app is five minutes.
      lastMeasured: async () => ({
        available: true,
        last: new Map([['a1:entry', new Date(NOW - 4 * 60_000).toISOString()]]),
      }),
    });
    await runCheckTick(h.deps);
    expect(h.written.filter((m) => m.subjectKey === 'entry')).toHaveLength(0);
  });

  it('due-ness comes from the stored rows, so a restart neither double-checks nor skips', async () => {
    const h = harness({
      lastMeasured: async () => ({
        available: true,
        last: new Map([['a1:entry', new Date(NOW - 6 * 60_000).toISOString()]]),
      }),
    });
    await runCheckTick(h.deps);
    expect(h.written.filter((m) => m.subjectKey === 'entry')).toHaveLength(1);
  });

  it('the slow subjects run on their own, much longer intervals', async () => {
    const h = harness({
      lastMeasured: async () => ({
        available: true,
        last: new Map([
          // Half an hour ago: the certificate is hourly, so not due.
          ['platform:cert', new Date(NOW - 30 * 60_000).toISOString()],
          // Six hours ago: the domain is twice-daily, so not due.
          ['platform:domain', new Date(NOW - 6 * 60 * 60_000).toISOString()],
        ]),
      }),
    });
    await runCheckTick(h.deps);
    expect(h.written.filter((m) => m.subjectKey === 'cert')).toHaveLength(0);
    expect(h.written.filter((m) => m.subjectKey === 'domain')).toHaveLength(0);
  });

  it('platform subjects ride the same instrument: same table, same shape, no app id (U5.5)', async () => {
    const h = harness({ webUrl: 'https://justgoblin.com', apiUrl: 'https://api.example.test' });
    await runCheckTick(h.deps);
    const platform = h.written.filter((m) => m.appId === null).map((m) => m.subjectKey).sort();
    expect(platform).toEqual(['api', 'cert', 'domain', 'web']);
  });

  it('an unconfigured platform URL produces NO row rather than a row about a made-up address', async () => {
    const h = harness({ webUrl: null, apiUrl: null });
    await runCheckTick(h.deps);
    expect(h.written.some((m) => m.subjectKey === 'web')).toBe(false);
    expect(h.written.some((m) => m.subjectKey === 'api')).toBe(false);
  });
});

describe('runCheckTick — honest degradation under partial failure', () => {
  it('an app that could not be checked gets an UNKNOWN ROW, not a carried-forward state', async () => {
    const h = harness({
      fetcher: (async () => {
        throw Object.assign(new Error('t'), { name: 'TimeoutError' });
      }) as unknown as typeof fetch,
    });
    await runCheckTick(h.deps);
    const entry = h.written.find((m) => m.subjectKey === 'entry');
    expect(entry).toBeDefined();
    expect(entry?.outcome).toBe('unknown');
    expect(entry?.httpStatus).toBeNull();
  });

  it('one app failing does not stop the fan-out — the others are still measured', async () => {
    let call = 0;
    const h = harness({
      listApps: async () => ({
        available: true,
        apps: [app({ appId: 'a1', appName: 'erste' }), app({ appId: 'a2', appName: 'zweite' })],
      }),
      fetcher: (async () => {
        call += 1;
        if (call === 1) throw Object.assign(new Error('x'), { code: 'ECONNREFUSED' });
        return new Response('', { status: 200 });
      }) as unknown as typeof fetch,
    });
    await runCheckTick(h.deps);
    const entries = h.written.filter((m) => m.subjectKey === 'entry');
    expect(entries).toHaveLength(2);
    expect(entries.find((m) => m.appId === 'a1')?.outcome).toBe('fail');
    expect(entries.find((m) => m.appId === 'a2')?.outcome).toBe('ok');
  });

  it('every measurement carries the time it was taken', async () => {
    const h = harness();
    await runCheckTick(h.deps);
    expect(h.written.length).toBeGreaterThan(0);
    for (const m of h.written) {
      expect(m.measuredAt).toBe(new Date(NOW).toISOString());
    }
  });

  it('prunes inside the tick, and reports the cutoff it used', async () => {
    const h = harness();
    const r = await runCheckTick(h.deps);
    expect(r.prunedBefore).toBe('2026-08-06T12:00:00.000Z');
  });

  it('a probe that THROWS costs its own row, not the whole batch', async () => {
    // None of the shipped probes throws. This asserts that the tick's guarantee is
    // structural rather than a coincidence of today's four probes: somebody else's
    // bug must not take away the rows of the apps already measured in this tick.
    const h = harness({
      listApps: async () => ({ available: true, apps: [app({ appId: 'a1' }), app({ appId: 'a2', appName: 'zweite' })] }),
      cert: async () => {
        throw new Error('boom');
      },
    });
    const r = await runCheckTick(h.deps);
    expect(r.ran).toBe(true);
    // Both apps still got measured…
    expect(h.written.filter((m) => m.subjectKey === 'entry')).toHaveLength(2);
    // …and the exploding probe recorded "we could not tell", like any other
    // failure of ours.
    const cert = h.written.find((m) => m.subjectKey === 'cert');
    expect(cert?.outcome).toBe('unknown');
    expect(cert?.detail).toBe('probe_error');
  });
});

describe('registrableDomainOf', () => {
  it('reduces a hostname to the registrable domain', () => {
    expect(registrableDomainOf('justgoblin.app')).toBe('justgoblin.app');
    expect(registrableDomainOf('meine-app.justgoblin.app')).toBe('justgoblin.app');
    expect(registrableDomainOf('a.b.c.example.com')).toBe('example.com');
  });
});
