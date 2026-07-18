// WAVE-H · H4 — the client half of honest concurrency shedding.
//
// When the server sheds a run at the admission cap it returns 429 `agent_at_capacity`
// (never a 500). The honest UX: show the user a calm "auf Anschlag" line in THEIR language
// and auto-retry after the server's Retry-After hint — so "dein Lauf startet in Kürze" is a
// TRUE statement (the run really does start shortly, without the user doing anything), not a
// promise we don't keep. Bounded so a persistently-saturated box eventually surfaces an
// honest "still busy" instead of retrying forever.

import type { StreamError } from './api';
import type { Lang } from './use-lang';

/** Machine code the API returns for an admission-shed run. */
export const AGENT_AT_CAPACITY = 'agent_at_capacity';

/** Is this error a concurrency-cap shed (as opposed to a real failure)? */
export function isAtCapacity(err: unknown): err is StreamError {
  return !!err && typeof err === 'object' && (err as StreamError).code === AGENT_AT_CAPACITY;
}

/** Max auto-retries before we stop and surface an honest "still busy" message. */
export const MAX_CAPACITY_RETRIES = 3;

/** Clamp the server's Retry-After to a sane client wait (defensive; server sends ~8s). */
export function capacityWaitMs(retryAfterSeconds: number | undefined): number {
  const s = typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0 ? retryAfterSeconds : 8;
  return Math.min(30, s) * 1000;
}

/** The calm waiting line while we auto-retry — localized, honest (the run is deferred). */
export function capacityWaitingCopy(lang: Lang, reason?: string): string {
  if (reason === 'per_user_limit') {
    return lang === 'en'
      ? 'You already have a run going — the next one starts as soon as it finishes. One moment…'
      : 'Du hast gerade schon einen Lauf offen — der nächste startet, sobald der fertig ist. Einen Moment…';
  }
  return lang === 'en'
    ? 'Goblin is at capacity right now — your run will start in a moment…'
    : 'Goblin ist gerade auf Anschlag — dein Lauf startet in Kürze…';
}

/** After exhausting retries: honest "still busy, try again shortly" — no fabricated state. */
export function capacityGaveUpCopy(lang: Lang): string {
  return lang === 'en'
    ? 'Goblin is still busy — please try your run again in a moment.'
    : 'Goblin ist noch ausgelastet — bitte starte deinen Lauf gleich noch einmal.';
}
