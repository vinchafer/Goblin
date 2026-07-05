// MOBILE-1 · M6 — Just-in-Time integration cards (spec §5).
//
// Integrations are pitched at the EARNED moment, not in onboarding: the GitHub
// card after the FIRST truth-gated successful publish, the Vercel-custom-domain
// card after the THIRD. Dismiss = don't repeat for 30 days, PER PROJECT. State is
// per-project localStorage (a project setting could replace it later without
// changing callers).

export type JitKind = "github" | "vercel";

const PUB_KEY = (pid: string) => `goblin:jit:pubcount:${pid}`;
const DISMISS_KEY = (pid: string, kind: JitKind) => `goblin:jit:dismiss:${kind}:${pid}`;
const DISMISS_DAYS = 30;

function readNum(key: string): number {
  try { const v = window.localStorage.getItem(key); return v ? parseInt(v, 10) || 0 : 0; } catch { return 0; }
}

/** Truth-gated successful publishes recorded for this project. */
export function getPublishCount(projectId: string): number {
  return readNum(PUB_KEY(projectId));
}

/** Record one successful publish; returns the new count. */
export function bumpPublishCount(projectId: string): number {
  const next = getPublishCount(projectId) + 1;
  try { window.localStorage.setItem(PUB_KEY(projectId), String(next)); } catch { /* ignore */ }
  return next;
}

/** Dismiss a JIT kind for this project for 30 days (records the expiry ts). */
export function dismissJit(projectId: string, kind: JitKind, days = DISMISS_DAYS, nowMs?: number): void {
  const now = nowMs ?? Date.now();
  try { window.localStorage.setItem(DISMISS_KEY(projectId, kind), String(now + days * 86_400_000)); } catch { /* ignore */ }
}

export function isJitDismissed(projectId: string, kind: JitKind, nowMs?: number): boolean {
  const until = readNum(DISMISS_KEY(projectId, kind));
  return until > (nowMs ?? Date.now());
}

/**
 * Which JIT card (if any) this project has earned right now. Vercel (3rd publish)
 * takes precedence over GitHub (1st) once earned; each respects its own 30-day
 * dismissal. Returns null when nothing is earned or all earned cards are dismissed.
 */
export function jitToShow(projectId: string, nowMs?: number): JitKind | null {
  const count = getPublishCount(projectId);
  if (count >= 3 && !isJitDismissed(projectId, "vercel", nowMs)) return "vercel";
  if (count >= 1 && !isJitDismissed(projectId, "github", nowMs)) return "github";
  return null;
}
