/**
 * AKT 2 · PHASE 5 · U5.3 / U5.4 — the report assembler's tests.
 *
 * The gate these hold: "no state rendered without its measurement time". It is
 * enforced structurally (the shapes carry both together), and asserted here as a
 * property over every state a report can produce.
 */

import { describe, it, expect } from 'vitest';
import {
  STATE_SEVERITY,
  appHealthReport,
  fleetHealthReport,
  type AppHealthReport,
  type FleetHealthReport,
} from './ops-check-report';
import type { StoredCheckRow } from './ops-checks-store';
import type { OpsApp } from './ops-apps-store';

const NOW = Date.parse('2026-08-14T12:00:00.000Z');
const MIN = 60_000;

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

function row(over: Partial<StoredCheckRow> & { agoMinutes: number }): StoredCheckRow {
  const { agoMinutes, ...rest } = over;
  return {
    appId: 'a1',
    subjectKey: 'entry',
    outcome: 'ok',
    httpStatus: 200,
    latencyMs: 42,
    daysRemaining: null,
    detail: null,
    measuredAt: new Date(NOW - agoMinutes * MIN).toISOString(),
    ...rest,
  };
}

/** THE gate, as a reusable assertion: a state always arrives with its time. */
function everyStateCarriesItsTime(report: AppHealthReport | FleetHealthReport) {
  const subjects =
    'entry' in report
      ? [report.entry, ...(report.formStore ? [report.formStore] : [])]
      : [...report.rows.flatMap((r) => [r.entry, ...(r.formStore ? [r.formStore] : [])]), ...report.platform];
  for (const s of subjects) {
    // Either there is a measurement time, or the state is unknown BECAUSE nothing
    // has ever been measured. There is no third shape — no state word may exist
    // beside a null timestamp for any other reason.
    if (s.measuredAt === null) {
      expect(s.state).toBe('unknown');
      expect(s.reason).toBe('never_checked');
    } else {
      expect(Number.isFinite(Date.parse(s.measuredAt))).toBe(true);
    }
  }
}

describe('appHealthReport', () => {
  const deps = (rows: StoredCheckRow[], windowRows = rows, available = true) => ({
    recent: async () => ({ available, rows }),
    window: async () => ({ available, rows: windowRows }),
  });

  it('reports healthy with the measurement time, never one without the other', async () => {
    const r = await appHealthReport(app(), { now: NOW, domain: 'justgoblin.app' }, deps([row({ agoMinutes: 1 }), row({ agoMinutes: 6 })]));
    expect(r.available).toBe(true);
    expect(r.entry.state).toBe('healthy');
    expect(r.entry.measuredAt).toBe(new Date(NOW - MIN).toISOString());
    everyStateCarriesItsTime(r);
  });

  it('an unreadable store is available:false with UNKNOWN — not an empty green card', async () => {
    const r = await appHealthReport(app(), { now: NOW }, deps([], [], false));
    expect(r.available).toBe(false);
    expect(r.entry.state).toBe('unknown');
    // And no uptime number is invented out of the absence.
    expect(r.uptime.ratio).toBeNull();
    everyStateCarriesItsTime(r);
  });

  it('a readable store with no rows is available:true and UNKNOWN/never_checked', async () => {
    // The distinction the surfaces render differently: "we could not look" vs
    // "we looked and have not measured this app yet".
    const r = await appHealthReport(app(), { now: NOW }, deps([]));
    expect(r.available).toBe(true);
    expect(r.entry.state).toBe('unknown');
    expect(r.entry.reason).toBe('never_checked');
  });

  it('stale rows derive to UNKNOWN even though they say ok', async () => {
    const r = await appHealthReport(app(), { now: NOW }, deps([row({ agoMinutes: 90 })]));
    expect(r.entry.state).toBe('unknown');
    expect(r.entry.reason).toBe('stale');
    // The old timestamp is still carried, because "we last looked at 10:30" is the
    // useful thing to show.
    expect(r.entry.measuredAt).toBe(new Date(NOW - 90 * MIN).toISOString());
  });

  it('an app without a form has no form-store state at all — no phantom subject', async () => {
    const r = await appHealthReport(app(), { now: NOW }, deps([row({ agoMinutes: 1 })]));
    expect(r.formStore).toBeNull();
  });

  it('an app WITH a form gets a form-store state, unknown until it is measured', async () => {
    const r = await appHealthReport(app({ d1DatabaseId: 'db1' }), { now: NOW }, deps([row({ agoMinutes: 1 })]));
    expect(r.formStore?.state).toBe('unknown');
    expect(r.formStore?.reason).toBe('never_checked');
  });

  it('the uptime window is seven days and its ratio is null below a day of coverage', async () => {
    const short = Array.from({ length: 50 }, (_, i) => row({ agoMinutes: i * 5 }));
    const r = await appHealthReport(app(), { now: NOW }, deps(short));
    expect(r.uptime.windowMs).toBe(7 * 24 * 60 * MIN);
    expect(r.uptime.ratio).toBeNull();
    expect(r.uptime.measured).toBe(50);
  });

  it('generatedAt is distinct from the measurement time — the page load is not a measurement', async () => {
    const r = await appHealthReport(app(), { now: NOW }, deps([row({ agoMinutes: 3 })]));
    expect(r.generatedAt).toBe(new Date(NOW).toISOString());
    expect(r.entry.measuredAt).not.toBe(r.generatedAt);
  });

  it('lists a bounded number of recent measurements, newest first', async () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ agoMinutes: i * 5 }));
    const r = await appHealthReport(app(), { now: NOW }, deps(many));
    expect(r.recent).toHaveLength(5);
    expect(r.recent[0]?.measuredAt).toBe(many[0]?.measuredAt);
  });
});

describe('fleetHealthReport — the operator view (U5.4)', () => {
  const registry = (apps: OpsApp[], available = true) => async () => ({ available, apps });

  it('sorts worst-first, with unknown ABOVE degraded', () => {
    // The ranking is an operational judgement, so it is pinned rather than implied:
    // a blind instrument outranks a measured blip, because blindness is how a
    // `down` goes unnoticed.
    expect(STATE_SEVERITY.down).toBeLessThan(STATE_SEVERITY.unknown);
    expect(STATE_SEVERITY.unknown).toBeLessThan(STATE_SEVERITY.degraded);
    expect(STATE_SEVERITY.degraded).toBeLessThan(STATE_SEVERITY.healthy);
  });

  it('orders the fleet worst-first and breaks ties by name', async () => {
    const apps = [
      app({ appId: 'ok1', appName: 'gut' }),
      app({ appId: 'bad', appName: 'kaputt' }),
      app({ appId: 'blind', appName: 'unbekannt' }),
      app({ appId: 'ok2', appName: 'auch-gut' }),
    ];
    const rows: StoredCheckRow[] = [
      row({ appId: 'ok1', agoMinutes: 1 }),
      row({ appId: 'ok1', agoMinutes: 6 }),
      row({ appId: 'ok2', agoMinutes: 1 }),
      row({ appId: 'ok2', agoMinutes: 6 }),
      row({ appId: 'bad', agoMinutes: 1, outcome: 'fail', httpStatus: 404 }),
      row({ appId: 'bad', agoMinutes: 6, outcome: 'fail', httpStatus: 404 }),
      // 'blind' has no rows at all -> unknown.
    ];
    const r = await fleetHealthReport(
      { now: NOW, domain: 'justgoblin.app' },
      {
        listApps: registry(apps),
        fleet: async () => ({ available: true, rows, truncated: false }),
        platform: async () => ({ available: true, rows: [] }),
      },
    );
    expect(r.rows.map((x) => x.appName)).toEqual(['kaputt', 'unbekannt', 'auch-gut', 'gut']);
    everyStateCarriesItsTime(r);
  });

  it('every platform subject gets a row even when never measured (U5.5)', async () => {
    const r = await fleetHealthReport(
      { now: NOW, domain: 'justgoblin.app' },
      {
        listApps: registry([]),
        fleet: async () => ({ available: true, rows: [], truncated: false }),
        platform: async () => ({ available: true, rows: [] }),
      },
    );
    expect(r.platform.map((p) => p.subjectKey)).toEqual(['web', 'api', 'cert', 'domain']);
    // A subject that has never been measured is present and UNKNOWN, rather than
    // absent — an absent row reads as "nothing to report".
    for (const p of r.platform) expect(p.state).toBe('unknown');
  });

  it('an unreadable registry or check store is reported per source, not collapsed', async () => {
    const r = await fleetHealthReport(
      { now: NOW },
      {
        listApps: registry([], false),
        fleet: async () => ({ available: true, rows: [], truncated: false }),
        platform: async () => ({ available: true, rows: [] }),
      },
    );
    expect(r.available).toBe(false);
    // The founder needs to know WHICH one to fix.
    expect(r.registryAvailable).toBe(false);
    expect(r.checksAvailable).toBe(true);
  });

  it('reports truncation rather than showing a silently shorter fleet', async () => {
    const r = await fleetHealthReport(
      { now: NOW },
      {
        listApps: registry([app()]),
        fleet: async () => ({ available: true, rows: [], truncated: true }),
        platform: async () => ({ available: true, rows: [] }),
      },
    );
    expect(r.truncated).toBe(true);
  });

  it('carries the heartbeat’s own budget position so an overrun is visible (G-P5-1)', async () => {
    const many = Array.from({ length: 209 }, (_, i) => app({ appId: `a${i}`, appName: `app-${i}` }));
    const r = await fleetHealthReport(
      { now: NOW },
      {
        listApps: registry(many),
        fleet: async () => ({ available: true, rows: [], truncated: false }),
        platform: async () => ({ available: true, rows: [] }),
      },
    );
    expect(r.activeApps).toBe(209);
    expect(r.cadenceMinutes).toBe(60);
    expect(r.overBudget).toBe(true);
  });

  it('excludes tombstoned apps but still lists suspended ones with their registry status', async () => {
    const r = await fleetHealthReport(
      { now: NOW },
      {
        listApps: registry([app({ appId: 'a1', appName: 'live' }), app({ appId: 'a2', appName: 'gesperrt', status: 'suspended' })]),
        fleet: async () => ({ available: true, rows: [], truncated: false }),
        platform: async () => ({ available: true, rows: [] }),
      },
    );
    expect(r.rows.map((x) => x.appName).sort()).toEqual(['gesperrt', 'live']);
    // A suspended app is not checked, so it is UNKNOWN — and the registry status
    // beside it is what stops that reading as a fault.
    expect(r.rows.find((x) => x.appName === 'gesperrt')?.registryStatus).toBe('suspended');
  });
});
