/**
 * FINAL-POLISH · U1 — "the user came back" detection.
 *
 * Goblin is phone-first, and every iPhone auto-locks within about a minute. When it does,
 * iOS SUSPENDS the installed PWA: open sockets (our SSE streams) die, but the page is
 * frozen rather than unloaded. Nothing remounts on return, so a mount-only probe — which
 * is all F-40 shipped — can never fire again, and the tab thaws showing a dead spinner
 * over a run the server has long since finished.
 *
 * The only reliable signals that we are back are `visibilitychange`, `pageshow` (bfcache
 * restore) and `online`. This module owns that rule in ONE place so the chat surface and
 * the agent surface cannot drift apart, and so the rule itself is unit-testable without a
 * DOM (the web test environment is `node`).
 *
 * The rule: a brief hide — flicking to the app switcher, pulling down a notification —
 * leaves a healthy stream alone. Past SUSPEND_SUSPECT_MS the socket must be assumed dead
 * and the caller re-attaches by force.
 */

/** Hidden at least this long ⇒ assume the connection did not survive. */
export const SUSPEND_SUSPECT_MS = 3000;

export interface ResumeVerdict {
  /** True when the socket must be treated as dead (re-attach even if we still think we're streaming). */
  force: boolean;
}

export interface ResumeDetector {
  /** The document went away. */
  hidden(): void;
  /** The document came back — how long it was away decides `force`. */
  visible(): ResumeVerdict;
  /** A bfcache restore or a regained connection: always suspect. */
  restored(): ResumeVerdict;
}

export function createResumeDetector(opts?: {
  initiallyHidden?: boolean;
  now?: () => number;
}): ResumeDetector {
  const now = opts?.now ?? (() => Date.now());
  let hiddenAt: number | null = opts?.initiallyHidden ? now() : null;
  return {
    hidden() {
      hiddenAt = now();
    },
    visible() {
      const hiddenFor = hiddenAt === null ? 0 : now() - hiddenAt;
      hiddenAt = null;
      return { force: hiddenFor >= SUSPEND_SUSPECT_MS };
    },
    restored() {
      hiddenAt = null;
      return { force: true };
    },
  };
}

/**
 * Wire the detector to the real page events. Returns the detach function.
 * A no-op (and a no-op detach) during SSR, where there is no document.
 */
export function bindResumeOnReturn(onReturn: (verdict: ResumeVerdict) => void): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const detector = createResumeDetector({ initiallyHidden: document.visibilityState === 'hidden' });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') detector.hidden();
    else onReturn(detector.visible());
  };
  const onRestore = () => onReturn(detector.restored());

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onRestore);
  window.addEventListener('online', onRestore);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onRestore);
    window.removeEventListener('online', onRestore);
  };
}
