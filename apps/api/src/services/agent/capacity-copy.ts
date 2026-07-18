// WAVE-H · H4 — the honest server-side "auf Anschlag" response for a run shed by the
// concurrency admission cap. Kept in its own module (mirroring the web's agent-capacity.ts)
// so the honest-copy contract is unit-testable without booting the whole route.
//
// This is NOT a failure and NOT a silent drop: a stable machine `code` the web maps to
// localized copy + a bounded auto-retry, a truthful German `message` as the always-present
// fallback (no English leak, no fabricated state), and the Retry-After hint. The copy is
// honest because the client re-submits after the hint — the run really does start shortly.

import type { AdmissionResult } from './run-registry';

export type CapacityRejection = Extract<AdmissionResult, { admitted: false }>;

export interface CapacityResponseBody {
  error: 'agent_at_capacity';
  reason: CapacityRejection['reason'];
  message: string;
  retryAfterSeconds: number;
}

/** The honest 429 body for an admission-shed run. German copy; the web localizes via `reason`. */
export function capacityResponseBody(v: CapacityRejection): CapacityResponseBody {
  const message =
    v.reason === 'per_user_limit'
      ? 'Du hast gerade schon einen Lauf offen — sobald der fertig ist, startet der nächste. Bitte einen kurzen Moment.'
      : 'Goblin ist gerade auf Anschlag — dein Lauf startet in Kürze.';
  return {
    error: 'agent_at_capacity',
    reason: v.reason,
    message,
    retryAfterSeconds: v.retryAfterSec,
  };
}
