// WAVE-D · D-2 — env-knobbed abuse caps for the actions a stranger (or an abuser) can
// drive server-side. Two shapes:
//   • count-per-window  → delegated to the hardened fixed-window limiter (hitRateLimit);
//   • bytes-per-day     → the daily accumulator below (attachments upload volume).
//
// Consistent with the existing in-memory daily caps (transcribe M8, search M11): the
// counters live per-process and reset on deploy. That is honest abuse resistance for
// the single-instance Phase-1 deployment; the durable cross-replica upgrade (a DB
// counter table, mirroring soft-limits' daily_request_counts) is a founder-gated infra
// decision recorded in the D-2 findings, NOT silently assumed here.

/** Read a positive-integer env knob, falling back to `def` when unset/invalid. */
function intKnob(name: string, def: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : def;
}

/** Max agent runs a single user may start per rolling hour. */
export function agentRunsPerHour(): number {
  return intKnob('AGENT_RUNS_PER_HOUR', 30);
}

/** Max publishes (Live-stellen) a single user may trigger per rolling hour. */
export function publishesPerHour(): number {
  return intKnob('PUBLISHES_PER_HOUR', 20);
}

/** Max attachment bytes a single user may upload for extraction per UTC day. */
export function attachmentBytesPerDay(): number {
  // Default 100 MB/day — generous for honest use, a hard ceiling against upload floods.
  return intKnob('ATTACHMENT_BYTES_PER_DAY', 100 * 1024 * 1024);
}

// ── bytes-per-day accumulator ───────────────────────────────────────────────────
// key = `${name}:${userId}:${UTC-day}` → bytes used so far today.
const dailyBytes = new Map<string, number>();
let lastSweepDay = '';

function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Drop yesterday's keys once per day so the map can't grow unbounded. */
function sweep(day: string): void {
  if (day === lastSweepDay) return;
  lastSweepDay = day;
  for (const key of dailyBytes.keys()) {
    if (!key.endsWith(`:${day}`)) dailyBytes.delete(key);
  }
}

export interface BytesCapResult {
  allowed: boolean;
  usedBytes: number;
  remainingBytes: number;
}

/**
 * Account `addBytes` against a user's daily byte budget for `name`. Returns allowed=false
 * (and does NOT consume) when the addition would exceed `capBytes`, so a denied request
 * never counts toward the cap. `nowMs` is injectable for deterministic tests.
 */
export function consumeDailyBytes(
  name: string,
  userId: string,
  addBytes: number,
  capBytes: number,
  nowMs: number = Date.now(),
): BytesCapResult {
  const day = utcDay(nowMs);
  sweep(day);
  const key = `${name}:${userId}:${day}`;
  const used = dailyBytes.get(key) ?? 0;
  if (used + addBytes > capBytes) {
    return { allowed: false, usedBytes: used, remainingBytes: Math.max(0, capBytes - used) };
  }
  dailyBytes.set(key, used + addBytes);
  return { allowed: true, usedBytes: used + addBytes, remainingBytes: Math.max(0, capBytes - used - addBytes) };
}

/** Test-only reset of the daily-bytes accumulator. */
export function __resetDailyBytesForTest(): void {
  dailyBytes.clear();
  lastSweepDay = '';
}
