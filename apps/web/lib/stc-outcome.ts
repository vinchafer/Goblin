// FOUNDER-WALK-7 · U2 (D-A) — what a Send-to-Code routing attempt actually achieved.
//
// D-A was not "the session does not open". The session opened; it was EMPTY, and
// an empty session that was supposed to receive code is indistinguishable — to the
// user and, until this module existed, to the code — from a session that is empty
// because nobody put anything in it yet. The founder clicked ten times because the
// product never told him which of the two he was looking at.
//
// This is the one place that decision is made, so the rule is stated once and the
// component only renders it.

import type { CreateSessionResult } from '@/hooks/code/useCodeSessions';

export type StcOutcome =
  /** The payload is in the session. Nothing to say. */
  | { kind: 'landed' }
  /** The session could not be created at all — the payload never got a home. */
  | { kind: 'no-session'; path: string | null }
  /** The session exists and the payload did not arrive in it. */
  | { kind: 'no-file'; path: string | null }
  /**
   * The server did not report an outcome (a deploy that predates the `initialFile`
   * field). We do not know, and "do not know" is NOT "landed" — but it is also not
   * grounds for telling the user something failed. Treated as landed, and named
   * here so the omission is a decision on the record rather than a default.
   */
  | { kind: 'unreported' };

/**
 * Classify what came back from `createSession` for a routed Send-to-Code payload.
 *
 * `requestedPath` is what the client tried to send, used only when the server
 * could not name a path itself (i.e. when there is no server answer at all).
 */
export function classifyStcOutcome(
  result: CreateSessionResult | null,
  requestedPath: string | null,
): StcOutcome {
  if (!result) return { kind: 'no-session', path: requestedPath };
  const outcome = result.initialFile;
  if (!outcome) return { kind: 'unreported' };
  if (!outcome.requested) return { kind: 'landed' };
  if (outcome.landed) return { kind: 'landed' };
  return { kind: 'no-file', path: outcome.path ?? requestedPath };
}

/** True when this outcome owes the user a visible message. */
export function stcNeedsNotice(outcome: StcOutcome): boolean {
  return outcome.kind === 'no-session' || outcome.kind === 'no-file';
}

/**
 * The sentence for a failed routing, in German.
 *
 * It states what did not happen and nothing more: no cause the client did not
 * establish, no prediction that retrying will work, no raw payload. The second
 * line is the only actionable truth available here — the chat still holds the code,
 * because this surface never took ownership of it.
 */
export function stcNoticeText(outcome: StcOutcome): { headline: string; detail: string } | null {
  if (outcome.kind === 'no-session') {
    return {
      headline: 'Der Code aus dem Chat konnte hier nicht abgelegt werden — die Session wurde nicht angelegt.',
      detail: 'Dein Chat hat den Code weiterhin. Du kannst ihn dort erneut an den Code-Tab senden.',
    };
  }
  if (outcome.kind === 'no-file') {
    return {
      headline: 'Die Session wurde angelegt, aber der Code aus dem Chat ist nicht darin angekommen.',
      detail: 'Dein Chat hat den Code weiterhin. Du kannst ihn dort erneut an den Code-Tab senden.',
    };
  }
  return null;
}
