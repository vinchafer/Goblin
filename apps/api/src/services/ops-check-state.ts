/**
 * AKT 2 · PHASE 5 · U5.2 — the state machine, as a PURE FUNCTION over measurements.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THIS FILE IS THE HONESTY CONTRACT. Everything else in Phase 5 is plumbing around
 * it: the runner produces rows, the store persists rows, the surfaces render what
 * this returns. If a green ever appears that nobody measured, it came from here.
 *
 * There is NO state stored anywhere. `deriveState()` is a function of the newest
 * rows and the current time, and nothing else — no cache, no carried-forward
 * previous verdict, no default. That is a deliberate structural choice, not a
 * stylistic one: a stored state has to be actively RESET when the instrument stops
 * measuring, and the reset is the line that gets forgotten. What is never stored
 * cannot go stale. See docs/ACT2_PHASE5_DECISIONS.md §P5-c.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── The three paths INTO unknown, which are the three the prompt names ──────────
 *   • cron gap        → the newest row is older than the freshness threshold
 *   • timeout         → the newest row's own outcome is 'unknown' (a timeout is
 *                       STORED as a measurement of "we could not tell", never
 *                       dropped — dropping it would leave a stale 'ok' newest)
 *   • our own outage  → whichever of the two above the outage produced
 *
 * ── The one path OUT of unknown ─────────────────────────────────────────────────
 * A fresh, conclusive measurement. There is no other. Because no previous state is
 * stored, there is nothing that could reappear.
 */

/** What one measurement concluded. `unknown` is a first-class result, not an error. */
export type CheckOutcome = 'ok' | 'warn' | 'fail' | 'unknown';

/** The four states. `unknown` is first-class and never renders as green or red. */
export type CheckState = 'healthy' | 'degraded' | 'down' | 'unknown';

/** Why a state is what it is — for copy, for tests, and for the operator view. */
export type CheckStateReason =
  /** No measurement exists at all. Never checked, or every row aged out. */
  | 'never_checked'
  /** The newest measurement is too old to speak for now. A gap in the checks. */
  | 'stale'
  /** The newest measurement could not reach a verdict (timeout, our own trouble). */
  | 'inconclusive'
  /** Every measurement in the window succeeded. */
  | 'all_ok'
  /** Some measurement in the window failed or warned, but not enough for `down`. */
  | 'mixed'
  /** The whole window failed. */
  | 'sustained_failure';

/** One measurement, as the derivation needs it. A subset of the stored row. */
export interface CheckRow {
  outcome: CheckOutcome;
  /** ISO-8601, from the runner's clock at measurement time. */
  measuredAt: string;
  httpStatus?: number | null;
  latencyMs?: number | null;
  daysRemaining?: number | null;
  detail?: string | null;
}

/**
 * How many consecutive failures before a subject is called `down`.
 *
 * TWO, and the cost of the two is stated in the UI rather than hidden. One failing
 * check is `degraded`, and one succeeding check after a failure is also `degraded`
 * — so a single blip cannot flap the state in either direction, and both the
 * detection and the recovery take exactly two cycles.
 *
 * The master plan's gate is "state flips within 2 cycles"; with this window it
 * flips to `degraded` after ONE and to `down` after TWO. Both numbers are measured
 * by the induced-failure harness rather than asserted here.
 */
export const DEBOUNCE_WINDOW = 2;

/**
 * A certificate is `warn` — not `fail` — this many days before it expires.
 *
 * Fourteen because Cloudflare's universal certificates renew automatically well
 * inside that, so a warn at 14 days means the automation did NOT happen, which is
 * exactly when a human should hear about it. A site with a valid certificate is
 * serving, so this is never `fail` while the certificate is still valid: `fail` is
 * reserved for expired, which is a real outage.
 */
export const CERT_WARN_DAYS = 14;

/**
 * How long a measurement speaks for its subject, per subject kind.
 *
 * Not one number, because the subjects move at different speeds. An entry check is
 * meaningless after twenty minutes; a domain registration date is meaningful for a
 * day. Using one threshold would either flag the domain check as stale constantly
 * or let a dead entry check pass as current.
 *
 * `entry` and `form_store` are computed from the live cadence rather than fixed —
 * see `freshnessMsFor()`. The fixed ones are floors and ceilings around that.
 */
export const FRESHNESS_MS = {
  /** Platform surfaces run every tick, like app entries. */
  web: null,
  api: null,
  /** Hourly probe, so six hours is three missed probes. */
  cert: 6 * 60 * 60_000,
  /** Twice-daily probe. A registration date does not change hourly. */
  domain: 48 * 60 * 60_000,
} as const;

/** The floor under the cadence-derived freshness: one slow tick is not a gap. */
export const MIN_FRESHNESS_MS = 20 * 60_000;

/**
 * How long a per-tick subject's measurement stays current, given the live cadence.
 *
 * THREE missed ticks, not one. A single tick can be late for reasons that are not
 * an outage — a slow fan-out, a deploy, a long D1 call — and calling that UNKNOWN
 * would make the state flicker on nothing. Three consecutive misses is a gap.
 *
 * Fixed subjects (`cert`, `domain`) ignore the cadence and use their own constant.
 */
export function freshnessMsFor(subjectKey: string, cadenceMinutes: number): number {
  const fixed = (FRESHNESS_MS as Record<string, number | null | undefined>)[subjectKey];
  if (typeof fixed === 'number') return fixed;
  return Math.max(MIN_FRESHNESS_MS, 3 * cadenceMinutes * 60_000);
}

/** What `deriveState` answers. Every field is measured or explicitly absent. */
export interface DerivedState {
  state: CheckState;
  reason: CheckStateReason;
  /**
   * WHEN the newest measurement happened — the timestamp every surface must render
   * beside the state. `null` only when there is no measurement at all, in which
   * case the state is `unknown` and the copy says "noch nie geprüft".
   *
   * It is NOT "now" and it is NOT the time of the page load. A surface that shows
   * a state without this value is showing a claim with no date on it.
   */
  measuredAt: string | null;
  /** The newest measurement's own outcome, for surfaces that show detail. */
  lastOutcome: CheckOutcome | null;
  /** How many rows the derivation actually looked at (≤ DEBOUNCE_WINDOW). */
  samples: number;
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

/**
 * THE derivation. Rows must be newest-first; anything else is a caller bug and is
 * defended against by sorting a copy.
 *
 * The rules are evaluated in order and the FIRST one that matches wins. The order
 * is the contract — moving rule 3 below rule 4, for instance, would let two
 * inconclusive checks read as `down`, which is a claim about the app made out of
 * our own inability to look.
 */
export function deriveState(
  rows: CheckRow[],
  opts: { now: number; freshnessMs: number; debounce?: number },
): DerivedState {
  const debounce = opts.debounce ?? DEBOUNCE_WINDOW;
  // Defensive sort: a caller that hands these over in the wrong order would
  // otherwise silently derive a state from the OLDEST measurements.
  const sorted = [...rows]
    .filter((r) => Number.isFinite(toMs(r.measuredAt)))
    .sort((a, b) => toMs(b.measuredAt) - toMs(a.measuredAt));

  // ── Rule 1 — nothing was ever measured ────────────────────────────────────
  const newest = sorted[0];
  if (!newest) {
    return { state: 'unknown', reason: 'never_checked', measuredAt: null, lastOutcome: null, samples: 0 };
  }

  const window = sorted.slice(0, debounce);

  // ── Rule 2 — the newest measurement is too old to speak for now ───────────
  // This is the cron gap and our own outage. Note it is checked BEFORE the
  // outcome: a row saying 'ok' from four hours ago is not evidence about now, and
  // rendering it as healthy would be the optimistic caching of a stale green that
  // the Feeling invariants forbid by name.
  if (opts.now - toMs(newest.measuredAt) > opts.freshnessMs) {
    return {
      state: 'unknown',
      reason: 'stale',
      measuredAt: newest.measuredAt,
      lastOutcome: newest.outcome,
      samples: window.length,
    };
  }

  // ── Rule 3 — the newest measurement reached no verdict ────────────────────
  // A timeout, an abort, a temporary DNS failure: anything that could equally be
  // OUR fault. Deliberately above rules 4–6 so that an inconclusive check can
  // never be combined with an older one into a confident answer.
  if (newest.outcome === 'unknown') {
    return {
      state: 'unknown',
      reason: 'inconclusive',
      measuredAt: newest.measuredAt,
      lastOutcome: 'unknown',
      samples: window.length,
    };
  }

  // ── Rules 4–6 — the window ────────────────────────────────────────────────
  // `unknown` rows inside the window (but not newest) are neither pass nor fail;
  // they are excluded from BOTH counts, so an inconclusive middle row can neither
  // rescue a failing app nor condemn a working one.
  const fails = window.filter((r) => r.outcome === 'fail').length;
  const warns = window.filter((r) => r.outcome === 'warn').length;
  const conclusive = window.filter((r) => r.outcome !== 'unknown').length;

  const base = { measuredAt: newest.measuredAt, lastOutcome: newest.outcome, samples: window.length };

  // Rule 4 — sustained failure. Requires a FULL window of conclusive failures:
  // one failure plus one inconclusive row is not two failures.
  if (fails >= debounce && fails === conclusive) {
    return { state: 'down', reason: 'sustained_failure', ...base };
  }
  // Rule 5 — anything measured went wrong, but not the whole window.
  if (fails > 0 || warns > 0) {
    return { state: 'degraded', reason: 'mixed', ...base };
  }
  // Rule 6 — everything the derivation could see was fine.
  return { state: 'healthy', reason: 'all_ok', ...base };
}

/**
 * The outcome for a certificate/domain expiry reading.
 *
 * `null` days means the date could not be read — which is `unknown`, never `ok`.
 * Zero or negative means expired, which is a real failure of a live surface.
 */
export function expiryOutcome(daysRemaining: number | null | undefined, warnDays = CERT_WARN_DAYS): CheckOutcome {
  if (daysRemaining === null || daysRemaining === undefined || !Number.isFinite(daysRemaining)) return 'unknown';
  if (daysRemaining <= 0) return 'fail';
  if (daysRemaining <= warnDays) return 'warn';
  return 'ok';
}

// ── Uptime over the retained window ─────────────────────────────────────────

/**
 * Below this much coverage, no percentage is shown at all.
 *
 * Twenty-four hours, because a percentage computed over two hours of a beta app
 * that nobody visits is a number with the shape of evidence and none of the
 * substance. The surface says "noch nicht genug Daten" and shows the counts, which
 * is both honest and more useful than 100,0 % from twelve samples.
 */
export const MIN_UPTIME_COVERAGE_MS = 24 * 60 * 60_000;

export interface UptimeSummary {
  /**
   * The measured availability, 0..1 — or `null` when there is not enough coverage
   * to state one. `null` is NOT zero and must never render as a red 0 %.
   */
  ratio: number | null;
  /** Measurements that reached a verdict — the denominator, shown beside the ratio. */
  measured: number;
  /** Of those, how many said the app was serving. */
  ok: number;
  /**
   * Measurements that reached NO verdict, counted and surfaced separately.
   *
   * These are excluded from the ratio (we cannot count what we did not measure as
   * either up or down) — and that exclusion is exactly what would flatter the
   * number if it were silent. It is not silent: every surface that shows `ratio`
   * shows this too.
   */
  inconclusive: number;
  /** How much wall-clock the samples actually span, in ms. Never assumed. */
  coveredMs: number;
  /** The window the caller asked about, so a surface can say "of 7 days, we have N". */
  windowMs: number;
}

/**
 * Availability over a window, from `entry` rows only.
 *
 * Deliberately not "all checks": a certificate warning is not downtime, and a form
 * store that blinked does not mean the page was unreachable. Uptime is a claim
 * about whether the thing answered, so it is computed from the check that asks
 * exactly that.
 */
export function uptimeSummary(rows: CheckRow[], opts: { now: number; windowMs: number }): UptimeSummary {
  const cutoff = opts.now - opts.windowMs;
  const inWindow = rows.filter((r) => {
    const t = toMs(r.measuredAt);
    return Number.isFinite(t) && t >= cutoff && t <= opts.now;
  });

  const measuredRows = inWindow.filter((r) => r.outcome !== 'unknown');
  const ok = measuredRows.filter((r) => r.outcome === 'ok' || r.outcome === 'warn').length;
  const inconclusive = inWindow.length - measuredRows.length;

  // Coverage is measured from the rows, not assumed from the window: an app
  // published yesterday has one day of history and its card must say so rather
  // than calling it a seven-day number.
  const times = inWindow.map((r) => toMs(r.measuredAt));
  const coveredMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;

  const enough = coveredMs >= MIN_UPTIME_COVERAGE_MS && measuredRows.length > 0;

  return {
    ratio: enough ? ok / measuredRows.length : null,
    measured: measuredRows.length,
    ok,
    inconclusive,
    coveredMs,
    windowMs: opts.windowMs,
  };
}
