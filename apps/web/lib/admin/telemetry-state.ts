// FOUNDER-WALK-2 U5.4 — honest telemetry display state.
//
// Two honesty defects on /admin/telemetry:
//  1. The calibration badge was HARD-CODED to "live · not yet calibrated" and
//     never read data.calibrated — a claimed state, right or wrong.
//  2. With no Goblin-hosted usage yet, the view still rendered precise figures
//     ($0.0000, weighted units, etc.) that read as calibrated/authoritative
//     rather than an honest "no live data" state (Feeling invariant: never
//     claim a non-verified state, never fabricate-looking numbers).
//
// This pure helper derives the display state from the real payload, so the page
// renders what is TRUE: a derived badge, an estimate caveat while uncalibrated,
// and an explicit empty note when there is no live data.

export interface TelemetrySummary {
  calibrated: boolean;
  totalTokens: number;
  activeUsers: number;
}

export interface TelemetryDisplay {
  /** true when the month has any real Goblin-hosted usage. */
  hasLiveData: boolean;
  /** true when the figures are calibrated (from the payload, never assumed). */
  calibrated: boolean;
  /** badge text derived from calibrated — never hard-coded. */
  calibrationLabel: string;
  /** show the "figures are a provisional estimate" caveat while uncalibrated. */
  showEstimateCaveat: boolean;
  /** an honest empty-state line when there is no live data, else null. */
  emptyNote: string | null;
}

export function telemetryDisplay(s: TelemetrySummary): TelemetryDisplay {
  const hasLiveData = (s.totalTokens ?? 0) > 0 || (s.activeUsers ?? 0) > 0;
  const calibrated = !!s.calibrated;
  return {
    hasLiveData,
    calibrated,
    calibrationLabel: calibrated ? 'live · calibrated' : 'live · not yet calibrated',
    showEstimateCaveat: !calibrated,
    emptyNote: hasLiveData
      ? null
      : 'No Goblin-hosted usage yet this month — the figures below are genuine zeroes, not calibrated estimates.',
  };
}
