/**
 * Per-plan STORAGE caps — the second enforced plan axis (alongside the weighted
 * Goblin token allowance in goblin-cap.ts). Pure, no network.
 *
 * Storage is REAL, enforced object-storage bytes (Backblaze B2): every footprint
 * write routes through file-storage.ts, which checks `currentBytes + incoming`
 * against the plan limit resolved here before the PutObject, and maintains the
 * running per-user total in `users.storage_bytes` (migration 0073). A nightly
 * reconcile (jobs/reconcile-storage.ts) walks B2 and corrects drift.
 *
 * ── THE NUMBERS (founder-locked 2026-06-28; do NOT recompute) ─────────────────
 *   none  0 GB  — locked / read-only (no active sub or trial)
 *   trial 2 GB
 *   build 10 GB
 *   pro   40 GB
 *   power 100 GB   (comped resolves to power via derivePlanTruth allowanceKey)
 *
 * Resolve the plan with derivePlanTruth() → allowanceKey, EXACTLY like the
 * build/token cap (goblin-cap.ts monthlyAllowanceForPlan). allowanceKey already
 * maps comped→'power' and none→'none', so storageLimitFor(allowanceKey) is the
 * single correct lookup on every read/enforcement path.
 *
 * Two-level truth parity: the GB figures here ARE user-facing (unlike the token
 * economics), and the web mirrors them in apps/web/lib/plan-storage.ts so the
 * pricing/billing copy can never drift from what the server enforces.
 */

/** 1 GB in bytes (binary — matches how "X GB" reads against B2 object sizes). */
export const BYTES_PER_GB = 1024 * 1024 * 1024;

/**
 * Per-plan storage limit in BYTES, keyed by the derivePlanTruth allowanceKey
 * (none/trial/build/pro/power). comped → 'power' upstream; none → 0 (read-only).
 */
export const STORAGE_LIMIT_BYTES: Record<string, number> = {
  none: 0,
  trial: 2 * BYTES_PER_GB,
  build: 10 * BYTES_PER_GB,
  pro: 40 * BYTES_PER_GB,
  power: 100 * BYTES_PER_GB,
};

/**
 * Conservative fallback for an unknown/missing plan key. 0 = locked: an
 * unresolvable plan can NEVER resolve to unlimited (or even Build) storage —
 * fail safe, never silently allow.
 */
export const STORAGE_DEFAULT_LIMIT = 0;

/** Resolve the storage limit (bytes) for a plan/allowance key (case-insensitive). */
export function storageLimitFor(planKey?: string | null): number {
  if (!planKey) return STORAGE_DEFAULT_LIMIT;
  return STORAGE_LIMIT_BYTES[planKey.toLowerCase()] ?? STORAGE_DEFAULT_LIMIT;
}

export interface StorageStatus {
  usedBytes: number;
  limitBytes: number;
  /** used / limit, clamped to [0, 1]; 0 when the limit is 0 (locked). */
  ratio: number;
  /** ratio as a 0-100 integer percent. */
  percent: number;
  /** true once usage has reached/exceeded the limit (or the plan is locked). */
  over: boolean;
}

/**
 * Thrown when a write would push the user past their plan's storage limit. Mapped
 * to HTTP 413 in app.onError with a clear DE message + a `code` the web localizes.
 */
export class StorageCapError extends Error {
  readonly code = 'storage_cap_exceeded';
  constructor(public readonly limitBytes: number, public readonly usedBytes: number) {
    super('Speicher voll — gib Platz frei oder upgrade auf einen grösseren Plan.');
    this.name = 'StorageCapError';
  }
}

/**
 * Thrown when the storage counter / plan cannot be read so the cap can't be
 * verified. Mapped to 503 — we FAIL SAFE (reject the write) rather than silently
 * allowing an unbounded write past an unknown limit.
 */
export class StorageUnavailableError extends Error {
  readonly code = 'storage_unavailable';
  constructor() {
    super('Speicher konnte nicht geprüft werden — bitte später erneut versuchen.');
    this.name = 'StorageUnavailableError';
  }
}

/** Compute display/enforcement status from a raw byte total + plan key. Defensive. */
export function computeStorageStatus(usedBytes: number, planKey?: string | null): StorageStatus {
  const used = Number.isFinite(usedBytes) && usedBytes > 0 ? usedBytes : 0;
  const limit = storageLimitFor(planKey);
  const ratio = limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0;
  return {
    usedBytes: used,
    limitBytes: limit,
    ratio,
    percent: Math.round(ratio * 100),
    over: limit <= 0 ? true : used >= limit,
  };
}
