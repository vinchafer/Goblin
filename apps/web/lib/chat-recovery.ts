/**
 * FOUNDER-WALK-4 · U1 — what happens to a chat turn when the iPhone locks.
 *
 * ── Why this file exists (the failure the previous fix did not close) ─────────
 *
 * FINAL-POLISH · U1 fixed two real things: the server stopped discarding the answer on a
 * client disconnect, and the client gained a `visibilitychange` trigger. The founder still
 * saw "Die Verbindung hat kurz gehakt — bitte versuch es erneut" on return, because the
 * defect that produces THAT STRING was never in either half.
 *
 * The string is `BLIPPED.de` in `friendly-error.ts`, and `connectionErrorMessage()` only
 * returns it when `navigator.onLine !== false` AND a live `/health` ping comes back 200.
 * That is a forensic fact, not a guess: the line can only be written once the network is
 * back — i.e. at or after the moment the founder unlocked the phone. So the dead stream's
 * `catch` in `standalone-chat` was still running at return, and it wrote LAST.
 *
 * Two writers, one piece of state, no ordering rule between them:
 *
 *   thaw ─┬─ visibilitychange → recoverAfterDisconnect() → (async: import, getSession,
 *         │                                                 fetch, poll) → setError(null)
 *         └─ the frozen socket's rejection → catch → await connectionErrorMessage()
 *                                                  → setError(BLIPPED) + sendFailed
 *
 * Whichever settles last wins, and the recovery path is by far the slower of the two —
 * a dynamic import plus a session read plus a transcript fetch, against a health ping that
 * was already in flight. The recovery could do everything right and still be overwritten
 * milliseconds later by a turn that had already been superseded. Nothing in the component
 * said "this turn is over, its writes no longer count".
 *
 * The second hole is the trigger itself. `createResumeDetector` decides to recover only if
 * it measured a long enough gap between a `hidden` event and a `visible` one. On a frozen
 * page that measurement is not guaranteed to exist: if the `hidden` transition is delivered
 * to a page iOS has already suspended, the handler runs at THAW, reads
 * `document.visibilityState === 'visible'`, and takes the return branch with no recorded
 * hide — `force: false`, recovery never fires at all. `resume-on-return.test.ts` even pins
 * that as intended behaviour ("does not force when the page was never hidden"). The rule
 * needs evidence that does not depend on an event surviving a freeze; stream QUIETNESS is
 * such evidence, and it is what we actually care about anyway.
 *
 * ── What cannot be fixed here, stated plainly ────────────────────────────────
 *
 * An in-flight `fetch` does NOT survive iOS suspending the app. There is no client-side
 * trick that keeps the SSE socket alive through a screen lock, and this file does not
 * pretend otherwise. What is fixable is everything after: the server finishes and persists
 * the turn (chat-sessions.ts), and on return the client ASKS the server what actually
 * happened instead of guessing. That is all this module does.
 *
 * ── Why the logic lives outside the component ────────────────────────────────
 *
 * The founder's sequence is an ORDERING bug, and ordering is exactly what a hand-run
 * device walk cannot re-check on every deploy. Everything here is framework-free and
 * clock-injected, so `chat-recovery.test.ts` can replay the real sequence — send, freeze,
 * late rejection, return — in both interleavings, with no DOM and no sleeping.
 */

// One definition of the suspend threshold, shared with the page-visibility binding, so the
// two halves of "we came back" can never drift to different numbers.
import { SUSPEND_SUSPECT_MS } from './resume-on-return';
export { SUSPEND_SUSPECT_MS };

/** How many times a recovery looks before it stops waiting on a turn that may still run. */
export const RECOVERY_ATTEMPTS = 5;

/** Backoff between recovery looks. Deliberately short: a normal turn is seconds. */
export function recoveryDelayMs(attempt: number): number {
  return 1500 + attempt * 1000;
}

// ─── The return rule ──────────────────────────────────────────────────────────

export interface ReturnInput {
  /** Is there a turn whose fate we do not know (streaming, errored, or a failed send)? */
  unresolved: boolean;
  /**
   * Time between the observed `hidden` and this return, or null when no hide was ever
   * observed — which is exactly what a page frozen before the event was delivered looks
   * like. `null` must never be read as "we were not away".
   */
  hiddenForMs: number | null;
  /**
   * Time since the local stream last produced anything, or null when no stream is running
   * (it already settled — with an error, in the case that matters).
   */
  quietForMs: number | null;
}

/**
 * Should the client ask the server what happened to this turn?
 *
 * Asking is a single authenticated GET and is always safe: the answer is adopted only when
 * the server actually has one (see `recoverTurn`), so a false positive here costs one
 * request and changes nothing on screen. A false NEGATIVE costs the founder their answer.
 * The rule is therefore deliberately biased towards asking.
 */
export function shouldAskServerOnReturn({ unresolved, hiddenForMs, quietForMs }: ReturnInput): boolean {
  if (!unresolved) return false;
  // No stream is running: whatever state we are in, only the server can resolve it.
  if (quietForMs === null) return true;
  // A stream that has said nothing for this long did not survive — whether or not we ever
  // saw the `hidden` event. This is the half the previous fix could not express.
  if (quietForMs >= SUSPEND_SUSPECT_MS) return true;
  // Fall back to the hide measurement when we have one.
  return hiddenForMs !== null && hiddenForMs >= SUSPEND_SUSPECT_MS;
}

// ─── The turn guard (the last-writer-wins fix) ────────────────────────────────

export interface TurnGuard {
  /** Start a turn. Returns its epoch; every write from that turn must carry it. */
  begin(): number;
  /** A recovery for the current turn has started. */
  beginRecovery(): void;
  /**
   * The recovery is done. `tookOver` is true for every outcome that decided the turn's
   * fate; false only when the recovery backed off because the stream turned out alive.
   */
  endRecovery(tookOver: boolean): void;
  /**
   * May this turn write incremental stream state (a delta)? Still true during a recovery —
   * a delta arriving mid-recovery is the proof of life the recovery is watching for.
   */
  mayStream(epoch: number): boolean;
  /**
   * May this turn write a TERMINAL outcome (the finished message, an error banner, a
   * failed-send marker)? False once a recovery has started for it, and false forever once
   * that recovery took over. This is the rule the founder's symptom needed.
   */
  mayFinish(epoch: number): boolean;
  recovering(): boolean;
}

export function createTurnGuard(): TurnGuard {
  let epoch = 0;
  let recovering = false;
  return {
    begin() {
      recovering = false;
      return ++epoch;
    },
    beginRecovery() {
      recovering = true;
    },
    endRecovery(tookOver: boolean) {
      recovering = false;
      // Retiring the epoch is what makes the takeover permanent: the superseded turn can
      // never write again, however late its rejection arrives.
      if (tookOver) epoch++;
    },
    mayStream(e: number) {
      return e === epoch;
    },
    mayFinish(e: number) {
      return e === epoch && !recovering;
    },
    recovering() {
      return recovering;
    },
  };
}

// ─── Asking the server ────────────────────────────────────────────────────────

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  has_code?: boolean;
  created_at: string;
}

/**
 * What the server said about the turn. Each variant is a DIFFERENT truth and gets different
 * copy — the founder asked which of these actually happens on a locked phone, and the
 * client can now answer that per incident instead of us inferring it once in a report.
 */
export type RecoveryOutcome =
  /** The turn finished while we were away. The transcript is the truth — adopt it. */
  | { kind: 'answered'; messages: TranscriptMessage[] }
  /** Our message reached the server, but no answer had landed by the time we stopped looking. */
  | { kind: 'still-running' }
  /** Our message is not on the server at all: the request died before it arrived. */
  | { kind: 'never-arrived' }
  /** The local stream produced something mid-recovery — it is alive, leave it alone. */
  | { kind: 'stream-alive' }
  /** We could not reach the server to ask. We know nothing, and say so. */
  | { kind: 'unreachable' };

export interface RecoverTurnDeps {
  /** The user message of the turn in question — how we tell "arrived" from "never arrived". */
  prompt: string;
  /** Fetch the session transcript. `null` means the request failed or was not ok. */
  fetchTranscript: () => Promise<TranscriptMessage[] | null>;
  /** True once the local stream has produced anything since the recovery began. */
  streamAlive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  attempts?: number;
}

/**
 * Ask the server what happened, briefly and honestly.
 *
 * A turn the user walked out on may still be running, so one look is not enough; but we
 * also never claim more than we saw. Nothing here writes UI state — the caller maps the
 * outcome to copy, which keeps this testable and keeps the copy in one place.
 */
export async function recoverTurn({
  prompt,
  fetchTranscript,
  streamAlive,
  sleep,
  attempts = RECOVERY_ATTEMPTS,
}: RecoverTurnDeps): Promise<RecoveryOutcome> {
  let everReached = false;
  let sawOurMessage = false;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Checked before every look: if the stream woke up, this turn was never dead and the
    // recovery must not touch it.
    if (streamAlive()) return { kind: 'stream-alive' };

    const messages = await fetchTranscript();
    if (messages) {
      everReached = true;
      if (messages.some((m) => m.role === 'user' && m.content === prompt)) sawOurMessage = true;
      const last = messages[messages.length - 1];
      // An assistant message LAST, with our message present, is the turn having finished.
      // Both halves matter: a trailing assistant row from an earlier turn is not our answer.
      if (sawOurMessage && last && last.role === 'assistant') {
        return { kind: 'answered', messages };
      }
    }

    if (attempt < attempts - 1) await sleep(recoveryDelayMs(attempt));
  }

  if (streamAlive()) return { kind: 'stream-alive' };
  if (!everReached) return { kind: 'unreachable' };
  return sawOurMessage ? { kind: 'still-running' } : { kind: 'never-arrived' };
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

/**
 * One honest line per outcome, in both languages.
 *
 * `null` for `answered` and `stream-alive`: there is nothing to apologise for — the answer
 * simply appears. No branch here says "bitte versuch es erneut" about work that exists,
 * and only `never-arrived` (the message provably did not reach the server) offers a resend.
 */
export function recoveryMessage(outcome: RecoveryOutcome['kind'], lang: 'de' | 'en'): string | null {
  const en = lang === 'en';
  switch (outcome) {
    case 'answered':
    case 'stream-alive':
      return null;
    case 'still-running':
      return en
        ? 'Your answer was still being written when I checked. It finishes on the server — reopen this chat in a moment to read it.'
        : 'Deine Antwort wurde noch geschrieben, als ich nachgesehen habe. Sie läuft auf dem Server zu Ende — öffne diesen Chat gleich nochmal, dann steht sie da.';
    case 'never-arrived':
      return en
        ? 'Your message never reached the server — the phone locked before it got out. Nothing was lost; send it again.'
        : 'Deine Nachricht hat den Server nie erreicht — das Handy war gesperrt, bevor sie raus war. Nichts ist verloren: schick sie einfach nochmal.';
    case 'unreachable':
      return en
        ? "I couldn't reach the server to check on your answer. Your message is saved — try again in a moment."
        : 'Der Server war nicht erreichbar, um nach deiner Antwort zu sehen. Deine Nachricht ist gespeichert — versuch es gleich nochmal.';
  }
}

/** The line shown WHILE the recovery is asking. It promises nothing. */
export function checkingMessage(lang: 'de' | 'en'): string {
  return lang === 'en'
    ? 'Connection lost — checking whether your answer finished …'
    : 'Verbindung unterbrochen — ich prüfe, ob deine Antwort fertig geworden ist …';
}

/** Only a provably-undelivered message gets the resend affordance. */
export function offersResend(outcome: RecoveryOutcome['kind']): boolean {
  return outcome === 'never-arrived';
}
