// AKT 2 · PHASE 5 · U5.4 — reading a derived state into console vocabulary.
//
// Same shape and same purpose as `orphan-view.ts`: the judgements the console
// makes about what it received live in a plain module a test can hold, rather than
// inside JSX where they are only ever exercised by looking at the page.
//
// The judgements here are two, and both are worth stating out loud:
//
//   1. UNKNOWN is never `ok` and never `bad`. It gets the dashed, colourless pill,
//      the same one the orphan card uses for "NICHT GEPRÜFT". There is no path in
//      this file from an absent measurement to a green.
//   2. Worst-first ranks UNKNOWN above `degraded`. `degraded` means we measured a
//      problem and are watching it; UNKNOWN means the instrument is blind, and a
//      blind instrument is how a real outage stays unnoticed. An operator should
//      fix their own blindness before studying somebody else's blip. (The API
//      sorts the rows; this constant is what lets the console sort the platform
//      subjects the same way and lets a test pin the ordering in one place.)

export type CheckState = 'healthy' | 'degraded' | 'down' | 'unknown';

export type CheckStateReason =
  | 'never_checked'
  | 'stale'
  | 'inconclusive'
  | 'all_ok'
  | 'mixed'
  | 'sustained_failure';

export interface SubjectStateView {
  subjectKey: string;
  state: CheckState;
  reason: CheckStateReason;
  /** Never optional. A state without its measurement time is a claim with no date. */
  measuredAt: string | null;
  lastOutcome: string | null;
  samples: number;
}

export interface FleetRowView {
  appId: string;
  appName: string;
  url: string;
  registryStatus: string;
  entry: SubjectStateView;
  formStore: SubjectStateView | null;
}

export interface ChecksBody {
  /** `null` = the console could not even ask. Distinct from `false` = we asked and could not read. */
  available: boolean | null;
  registryAvailable: boolean | null;
  checksAvailable: boolean | null;
  truncated?: boolean;
  rows: FleetRowView[];
  platform: SubjectStateView[];
  cadenceMinutes?: number;
  requestsPerDay?: number;
  overBudget?: boolean;
  activeApps?: number;
  lastTick?: {
    ran: boolean;
    skipped?: 'disabled' | 'store_unavailable' | 'nothing_due';
    recorded: boolean;
    measured: { ok: number; warn: number; fail: number; unknown: number };
    at: string;
  } | null;
  generatedAt?: string;
}

/** The pill class. `unknown` is dashed and colourless — never green, never red. */
export function stateClass(state: CheckState): 'ok' | 'bad' | 'warn' | 'unknown' {
  switch (state) {
    case 'healthy':
      return 'ok';
    case 'down':
      return 'bad';
    case 'degraded':
      return 'warn';
    default:
      return 'unknown';
  }
}

/** Worst first. See the header for why UNKNOWN outranks `degraded`. */
export const STATE_SEVERITY: Record<CheckState, number> = {
  down: 0,
  unknown: 1,
  degraded: 2,
  healthy: 3,
};

/** Sorts a copy, worst first, ties by name — stable between refreshes. */
export function worstFirst<T extends { entry: SubjectStateView; appName: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const bySeverity = STATE_SEVERITY[a.entry.state] - STATE_SEVERITY[b.entry.state];
    return bySeverity !== 0 ? bySeverity : a.appName.localeCompare(b.appName);
  });
}

/**
 * Is there anything on this card an operator has to act on?
 *
 * `true` for down, degraded AND unknown. Blindness counts as "not fine" — the
 * whole reason this card exists is that a fleet nobody can see is not a fleet
 * that is fine.
 */
export function anythingNotFine(body: ChecksBody): boolean {
  if (body.available !== true) return true;
  const subjects = [...body.rows.flatMap((r) => [r.entry, ...(r.formStore ? [r.formStore] : [])]), ...body.platform];
  return subjects.some((s) => s.state !== 'healthy');
}

/**
 * The measurement time as a local clock stamp, or `null` when there is none.
 *
 * Returns `null` rather than a placeholder string on purpose: the caller has to
 * decide what to render for "never measured", and a helper that quietly returned
 * a dash would let a caller print a state beside it without noticing.
 */
export function measuredStamp(measuredAt: string | null, lang: 'de' | 'en'): string | null {
  if (!measuredAt) return null;
  const d = new Date(measuredAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
