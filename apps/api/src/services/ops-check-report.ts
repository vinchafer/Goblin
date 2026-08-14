/**
 * AKT 2 · PHASE 5 · U5.3 / U5.4 / U5.5 — one place that turns stored measurements
 * into the answer both surfaces render.
 *
 * ── Why one module and not two ──────────────────────────────────────────────────
 * The owner's status card and the founder console ask the same question about the
 * same rows. Two implementations of "what state is this app in" is how one surface
 * ends up saying `erreichbar` while the other says UNBEKANNT — the exact defect
 * `ops-forms-config.ts` was written to prevent for the forms configuration, and the
 * same argument applies with more force here, because this is the phase whose whole
 * product claim is that the answer is trustworthy.
 *
 * ── What every shape in this file guarantees ────────────────────────────────────
 * `measuredAt` travels with `state`, always, in the same object. There is no shape
 * here that can carry a state without the time it was measured, so no renderer can
 * accidentally show one without the other — the "Erreichbar" alone is a lie by
 * omission invariant, enforced by the type rather than by discipline.
 *
 * `available: false` (we could not read the store) is kept distinct from an empty
 * result (we read it, this app has never been checked). Both derive to UNKNOWN and
 * they are different founder actions: apply 0103, versus wait for the first tick.
 */

import { appUrl } from './ops-app-names';
import { opsAppsDomain } from './cf-deploy';
import { cadenceFor } from './ops-check-budget';
import {
  deriveState,
  freshnessMsFor,
  uptimeSummary,
  type CheckState,
  type CheckStateReason,
  type DerivedState,
  type UptimeSummary,
} from './ops-check-state';
import {
  entryChecksInWindow,
  newestChecksForAllApps,
  recentChecksForApp,
  recentPlatformChecks,
  type StoredCheckRow,
} from './ops-checks-store';
import { listAllOpsApps, type OpsApp } from './ops-apps-store';

/** The uptime window the card reports on. */
export const UPTIME_WINDOW_MS = 7 * 24 * 60 * 60_000;

/** How many individual measurements the owner's card lists. */
export const RECENT_CHECKS_SHOWN = 5;

/** One measurement, as a surface renders it. Never a detail with content in it. */
export interface CheckLine {
  subjectKey: string;
  outcome: string;
  httpStatus: number | null;
  latencyMs: number | null;
  measuredAt: string;
  detail: string | null;
}

/** A derived state plus the subject it is about. `measuredAt` is never optional. */
export interface SubjectState extends DerivedState {
  subjectKey: string;
}

export interface AppHealthReport {
  /** False = the check store could not be read. NOT "no checks" — the card says so. */
  available: boolean;
  appId: string;
  appName: string;
  url: string;
  /** The registry's own status, so a suspended app is not reported as "down". */
  registryStatus: string;
  /** Availability of the public entry — the state the card leads with. */
  entry: SubjectState;
  /** Present only for apps that have a form. `null` means "this app has no inbox". */
  formStore: SubjectState | null;
  uptime: UptimeSummary;
  /** The last few measurements, newest first. */
  recent: CheckLine[];
  /** The cadence in force right now, so copy can say how often it looks. */
  cadenceMinutes: number;
  /**
   * WHEN this report was assembled — distinct from `entry.measuredAt`, and the
   * distinction matters: this is when we ASKED the database, that is when we last
   * asked the app. A surface that shows only this one would be dating the page
   * load, not the measurement.
   */
  generatedAt: string;
}

function toLine(row: StoredCheckRow): CheckLine {
  return {
    subjectKey: row.subjectKey,
    outcome: row.outcome,
    httpStatus: row.httpStatus ?? null,
    latencyMs: row.latencyMs ?? null,
    measuredAt: row.measuredAt,
    detail: row.detail ?? null,
  };
}

const UNAVAILABLE = (subjectKey: string): SubjectState => ({
  subjectKey,
  state: 'unknown',
  // `never_checked` is the honest reason when we could not look at all: we hold no
  // measurement. The `available: false` beside it is what tells the surface WHY.
  reason: 'never_checked',
  measuredAt: null,
  lastOutcome: null,
  samples: 0,
});

/**
 * Everything the owner's card shows about one app.
 *
 * `activeAppCount` is passed in rather than counted here so the caller can do one
 * registry read for a page that shows several apps. It only feeds the cadence,
 * which only feeds the freshness threshold and the copy — never the state itself.
 */
export async function appHealthReport(
  app: OpsApp,
  opts: { now?: number; activeAppCount?: number; domain?: string } = {},
  deps: {
    recent?: typeof recentChecksForApp;
    window?: typeof entryChecksInWindow;
  } = {},
): Promise<AppHealthReport> {
  const now = opts.now ?? Date.now();
  const domain = opts.domain ?? opsAppsDomain();
  const cadenceMinutes = cadenceFor(opts.activeAppCount ?? 1).cadenceMinutes;

  const readRecent = deps.recent ?? recentChecksForApp;
  const readWindow = deps.window ?? entryChecksInWindow;

  const [recent, window] = await Promise.all([
    readRecent(app.appId, { limit: 40 }),
    readWindow(app.appId, UPTIME_WINDOW_MS, { now }),
  ]);

  const base = {
    appId: app.appId,
    appName: app.appName,
    url: domain ? appUrl(app.appName, domain) : '',
    registryStatus: app.status,
    cadenceMinutes,
    generatedAt: new Date(now).toISOString(),
  };

  if (!recent.available) {
    return {
      ...base,
      available: false,
      entry: UNAVAILABLE('entry'),
      formStore: app.d1DatabaseId ? UNAVAILABLE('form_store') : null,
      // An unreadable store yields no uptime, and `ratio: null` is the shape the
      // card renders as "noch nicht genug Daten" — never as 0 %.
      uptime: uptimeSummary([], { now, windowMs: UPTIME_WINDOW_MS }),
      recent: [],
    };
  }

  const entryRows = recent.rows.filter((r) => r.subjectKey === 'entry');
  const formRows = recent.rows.filter((r) => r.subjectKey === 'form_store');

  return {
    ...base,
    available: true,
    entry: {
      subjectKey: 'entry',
      ...deriveState(entryRows, { now, freshnessMs: freshnessMsFor('entry', cadenceMinutes) }),
    },
    formStore: app.d1DatabaseId
      ? { subjectKey: 'form_store', ...deriveState(formRows, { now, freshnessMs: freshnessMsFor('form_store', cadenceMinutes) }) }
      : null,
    // The uptime window read is separate and can fail on its own; when it does the
    // summary is computed over no rows and comes out `null`, which is right.
    uptime: uptimeSummary(window.available ? window.rows : [], { now, windowMs: UPTIME_WINDOW_MS }),
    recent: recent.rows.slice(0, RECENT_CHECKS_SHOWN).map(toLine),
  };
}

// ── The operator's fleet view (U5.4) ────────────────────────────────────────

/**
 * Worst-first, so the founder's eye lands on what is not fine.
 *
 * `unknown` is ranked ABOVE `degraded` on purpose, and the reasoning is
 * operational rather than aesthetic: `degraded` means we measured a problem and
 * are watching it, while `unknown` means the instrument is blind — and a blind
 * instrument is how a `down` goes unnoticed. An operator should fix their own
 * blindness before they study somebody else's blip.
 */
export const STATE_SEVERITY: Record<CheckState, number> = {
  down: 0,
  unknown: 1,
  degraded: 2,
  healthy: 3,
};

export interface FleetRow {
  appId: string;
  appName: string;
  url: string;
  registryStatus: string;
  entry: SubjectState;
  formStore: SubjectState | null;
}

export interface FleetHealthReport {
  /** False = the registry or the check store could not be read. Renders UNKNOWN. */
  available: boolean;
  /** Which of the two could not be read, so the founder knows what to fix. */
  registryAvailable: boolean;
  checksAvailable: boolean;
  /** True when the fleet read hit its row ceiling — stated, never silently short. */
  truncated: boolean;
  rows: FleetRow[];
  /** Goblin's own surfaces, through the same derivation (U5.5). */
  platform: SubjectState[];
  cadenceMinutes: number;
  /** The heartbeat's own budget position, so an overrun is visible (G-P5-1). */
  requestsPerDay: number;
  overBudget: boolean;
  activeApps: number;
  generatedAt: string;
}

/** Every platform subject gets a row even when it has never been measured. */
const PLATFORM_ORDER = ['web', 'api', 'cert', 'domain'] as const;

export async function fleetHealthReport(
  opts: { now?: number; domain?: string } = {},
  deps: {
    listApps?: typeof listAllOpsApps;
    fleet?: typeof newestChecksForAllApps;
    platform?: typeof recentPlatformChecks;
  } = {},
): Promise<FleetHealthReport> {
  const now = opts.now ?? Date.now();
  const domain = opts.domain ?? opsAppsDomain();

  const [registry, fleet, platform] = await Promise.all([
    (deps.listApps ?? listAllOpsApps)(),
    (deps.fleet ?? newestChecksForAllApps)({}),
    (deps.platform ?? recentPlatformChecks)({}),
  ]);

  const apps = registry.apps.filter((a) => a.status !== 'deleted');
  const activeApps = registry.apps.filter((a) => a.status === 'active').length;
  const plan = cadenceFor(activeApps);
  const freshEntry = freshnessMsFor('entry', plan.cadenceMinutes);

  const byApp = new Map<string, StoredCheckRow[]>();
  for (const row of fleet.rows) {
    if (!row.appId) continue;
    const list = byApp.get(row.appId);
    if (list) list.push(row);
    else byApp.set(row.appId, [row]);
  }

  const rows: FleetRow[] = apps.map((a) => {
    const mine = byApp.get(a.appId) ?? [];
    return {
      appId: a.appId,
      appName: a.appName,
      url: domain ? appUrl(a.appName, domain) : '',
      registryStatus: a.status,
      entry: {
        subjectKey: 'entry',
        ...deriveState(mine.filter((r) => r.subjectKey === 'entry'), { now, freshnessMs: freshEntry }),
      },
      formStore: a.d1DatabaseId
        ? {
            subjectKey: 'form_store',
            ...deriveState(mine.filter((r) => r.subjectKey === 'form_store'), {
              now,
              freshnessMs: freshnessMsFor('form_store', plan.cadenceMinutes),
            }),
          }
        : null,
    };
  });

  // Worst first; ties broken by name so the order is stable between refreshes and
  // the founder's eye can rely on position.
  rows.sort((a, b) => {
    const bySeverity = STATE_SEVERITY[a.entry.state] - STATE_SEVERITY[b.entry.state];
    return bySeverity !== 0 ? bySeverity : a.appName.localeCompare(b.appName);
  });

  const platformStates: SubjectState[] = PLATFORM_ORDER.map((key) => ({
    subjectKey: key,
    ...deriveState(platform.rows.filter((r) => r.subjectKey === key), {
      now,
      freshnessMs: freshnessMsFor(key, plan.cadenceMinutes),
    }),
  }));

  return {
    available: registry.available && fleet.available,
    registryAvailable: registry.available,
    checksAvailable: fleet.available,
    truncated: fleet.truncated,
    rows,
    platform: platformStates,
    cadenceMinutes: plan.cadenceMinutes,
    requestsPerDay: plan.requestsPerDay,
    overBudget: plan.overBudget,
    activeApps,
    generatedAt: new Date(now).toISOString(),
  };
}

/** Re-exported so surfaces import one module rather than three. */
export type { CheckState, CheckStateReason, UptimeSummary };
