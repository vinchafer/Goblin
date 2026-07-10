/**
 * Per-call timeout guard (webhook hardening, 2026-07-08).
 *
 * Wraps a promise so a stalled upstream (Supabase write, Stripe API call) can
 * never hang the caller indefinitely. On timeout the returned promise rejects
 * with a `TimeoutError` — the caller decides whether that means "release the job
 * for retry" (webhook processor) or "surface a 500".
 *
 * This does NOT cancel the underlying work (JS promises aren't cancellable); it
 * only stops the caller from *awaiting* it forever. For the webhook path that is
 * exactly what we want: a timed-out side effect leaves the job releasable and a
 * later retry re-applies it idempotently.
 */

export class TimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;
  constructor(label: string, timeoutMs: number) {
    super(`timeout after ${timeoutMs}ms: ${label}`);
    this.name = 'TimeoutError';
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

export function isTimeoutError(e: unknown): e is TimeoutError {
  return e instanceof TimeoutError;
}

/**
 * Resolve/reject with `promise`, or reject with TimeoutError after `timeoutMs`.
 * The timer is always cleared so a fast resolution doesn't keep the event loop
 * alive.
 */
export function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Read a timeout from an env var (milliseconds), falling back to a default.
 * Ignores non-positive / non-numeric values so a typo can't disable the guard.
 */
export function envTimeoutMs(envVar: string, defaultMs: number): number {
  const raw = process.env[envVar];
  if (!raw) return defaultMs;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}
