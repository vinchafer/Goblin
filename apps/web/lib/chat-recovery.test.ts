/**
 * FOUNDER-WALK-4 · U1 — the founder's walk, replayed.
 *
 * The device sequence these tests stand in for:
 *
 *   1. give a chat task on the iPhone   → a turn starts, the SSE stream opens
 *   2. lock the screen                  → iOS backgrounds, then FREEZES the PWA
 *   3. the socket dies while frozen     → nothing runs; the rejection is queued
 *   4. unlock and return                → the frozen work AND the return event both thaw
 *
 * Step 4 is the whole defect. Two independent writers wake up at once — the dead turn's
 * rejection (which ends in `connectionErrorMessage()` → "Die Verbindung hat kurz gehakt")
 * and the return handler (which asks the server and finds the finished answer) — and
 * before this unit there was no rule about which one owned the screen. The founder kept
 * seeing the losing one.
 *
 * So every ordering below is exercised on purpose, and each asserts the same invariant:
 *
 *   AN ANSWER THE SERVER HAS IS NEVER REPLACED BY A "TRY AGAIN".
 *
 * No DOM, no sleeping: the clock and the sleep are injected, which is why these can run in
 * the `node` environment the web vitest config uses.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createTurnGuard,
  recoverTurn,
  recoveryMessage,
  offersResend,
  shouldAskServerOnReturn,
  checkingMessage,
  resendHint,
  resendActionLabel,
  SUSPEND_SUSPECT_MS,
  RECOVERY_ATTEMPTS,
  type TranscriptMessage,
  type TurnStatus,
} from './chat-recovery';

const PROMPT = 'Bau mir eine Newsletter-Seite';
/** The exact string the founder reported, twice. It must not survive any sequence here. */
const BLIPPED = 'Die Verbindung hat kurz gehakt — bitte versuch es erneut.';

function userMsg(content = PROMPT): TranscriptMessage {
  return { id: 'u1', role: 'user', content, created_at: '2026-08-06T10:00:00.000Z' };
}
function assistantMsg(content = 'Hier ist deine Seite …'): TranscriptMessage {
  return { id: 'a1', role: 'assistant', content, created_at: '2026-08-06T10:00:20.000Z' };
}

/**
 * A stand-in for the chat surface: the same three pieces of state the component writes
 * (transcript, error banner, failed-send marker) behind the same guard it now uses. The
 * point is the ORDERING rules, so nothing here renders.
 */
const RUNNING: TurnStatus = { state: 'running', reason: null, verified: true };
const LOST_MAX_RUNTIME: TurnStatus = { state: 'lost', reason: 'max_runtime', verified: true };
const NO_RECORD: TurnStatus = { state: 'unknown', reason: null, verified: false };

function makeSurface(server: {
  transcript: () => TranscriptMessage[] | null;
  /** What GET /turn-status answers. Defaults to "this process has no record". */
  turnStatus?: () => TurnStatus | null;
}) {
  const guard = createTurnGuard();
  const state = {
    messages: [] as TranscriptMessage[],
    error: null as string | null,
    streaming: false,
    sendFailed: false,
  };
  let epoch = 0;
  let lastActivityAt: number | null = null;
  let now = 0;

  const api = {
    state,
    guard,
    advance(ms: number) { now += ms; },

    /** Step 1 — the user sends. */
    send() {
      epoch = guard.begin();
      state.messages = [userMsg()];
      state.streaming = true;
      state.error = null;
      state.sendFailed = false;
      lastActivityAt = now;
    },

    /** A delta arrives (proof the stream is alive). */
    delta() {
      if (!guard.mayStream(epoch)) return false;
      lastActivityAt = now;
      return true;
    },

    /**
     * Step 3/4 — the dead socket's rejection lands. This is `handleSubmit`'s catch:
     * `isConnectionError(err)` → mark the send failed and show the health-ping verdict,
     * which on a network that is back is exactly BLIPPED.
     */
    streamRejected() {
      if (!guard.mayFinish(epoch)) return false; // superseded — this turn no longer owns the screen
      state.streaming = false;
      state.sendFailed = true;
      state.error = BLIPPED;
      lastActivityAt = null;
      return true;
    },

    /** Step 4 — the page is visible again. */
    async returned(hiddenForMs: number | null) {
      const unresolved = state.streaming || state.error !== null || state.sendFailed;
      const quietForMs = lastActivityAt === null ? null : now - lastActivityAt;
      if (!shouldAskServerOnReturn({ unresolved, hiddenForMs, quietForMs })) return null;

      guard.beginRecovery();
      state.error = checkingMessage('de');
      const activityAtStart = lastActivityAt;

      const outcome = await recoverTurn({
        prompt: PROMPT,
        fetchTranscript: async () => server.transcript(),
        fetchTurnStatus: async () => (server.turnStatus ? server.turnStatus() : NO_RECORD),
        streamAlive: () => lastActivityAt !== null && lastActivityAt !== activityAtStart,
        sleep: async () => {},
      });

      guard.endRecovery(outcome.kind !== 'stream-alive');
      if (outcome.kind === 'answered') {
        state.messages = outcome.messages;
        state.streaming = false;
        state.sendFailed = false;
      } else if (outcome.kind !== 'stream-alive') {
        state.streaming = false;
        state.sendFailed = offersResend(outcome.kind);
      }
      state.error = recoveryMessage(outcome.kind, 'de');
      return outcome;
    },
  };
  return api;
}

// ─── The founder's walk, both interleavings ───────────────────────────────────

describe("the founder's walk: task → lock → freeze → return", () => {
  it('the answer that finished server-side is shown, not a "try again" (rejection lands FIRST)', async () => {
    // The socket dies during the hide; the queued rejection is delivered the instant the
    // page thaws, just before the visibility handler runs.
    const server = { transcript: () => [userMsg(), assistantMsg()] };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);            // phone locked, founder walks to the PC
    expect(s.streamRejected()).toBe(true);
    expect(s.state.error).toBe(BLIPPED); // the state the founder photographed

    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('answered');
    expect(s.state.error).toBeNull();
    expect(s.state.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(s.state.sendFailed).toBe(false);
  });

  it('the answer survives even when the rejection lands DURING the recovery', async () => {
    // The interleaving the previous fix lost to: the recovery starts first, then the
    // health ping that was already in flight resolves and the catch writes BLIPPED over it.
    const server = { transcript: () => [userMsg(), assistantMsg()] };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);

    const pending = s.returned(60_000);
    // …the rejection thaws while the recovery is mid-flight.
    expect(s.streamRejected()).toBe(false); // refused: a recovery owns this turn now
    const outcome = await pending;

    expect(outcome?.kind).toBe('answered');
    expect(s.state.error).toBeNull();
    expect(s.state.messages).toHaveLength(2);
  });

  it('the answer survives a rejection that lands AFTER the recovery finished', async () => {
    // The slowest of the three: the health ping's 3s timeout outlives the recovery.
    const server = { transcript: () => [userMsg(), assistantMsg()] };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    await s.returned(60_000);
    expect(s.state.error).toBeNull();

    expect(s.streamRejected()).toBe(false); // the epoch was retired — this turn is over
    expect(s.state.error).toBeNull();
    expect(s.state.messages).toHaveLength(2);
  });

  it('recovers when the hide was never observed — the frozen-page case the old rule missed', async () => {
    // iOS delivered `visibilitychange` to an already-suspended page, so the handler runs at
    // THAW and reads visibilityState === 'visible': there is no measured hide at all.
    // The old detector answered force:false here and the recovery never ran.
    const server = { transcript: () => [userMsg(), assistantMsg()] };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);

    const outcome = await s.returned(null); // ← no hide measurement exists
    expect(outcome?.kind).toBe('answered');
    expect(s.state.error).toBeNull();
  });
});

// ─── The honest outcomes ──────────────────────────────────────────────────────

describe('what the server actually says, said honestly', () => {
  it('a message that never reached the server is named as such, and offers a resend', async () => {
    // The lock beat the request out of the device: the transcript has neither our message
    // nor an answer. This is the ONE case where "send it again" is the truth.
    const server = { transcript: () => [] as TranscriptMessage[] };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('never-arrived');
    expect(s.state.sendFailed).toBe(true);
    expect(s.state.error).toMatch(/nie erreicht/);
    expect(s.state.error).not.toBe(BLIPPED);
  });

  it('a lost verdict ends the recovery at once — no more waiting on nothing', async () => {
    // Every extra look after a `lost` is another second of the promise the founder already
    // sat through. The verdict is terminal, so the recovery stops on the FIRST one.
    const fetchTranscript = vi.fn(async () => [userMsg()]);
    const sleep = vi.fn(async () => {});
    const outcome = await recoverTurn({
      prompt: PROMPT, fetchTranscript, fetchTurnStatus: async () => LOST_MAX_RUNTIME,
      streamAlive: () => false, sleep,
    });
    expect(outcome.kind).toBe('lost');
    expect(fetchTranscript).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('a turn the server CONFIRMS is running is reported as running — no resend, no discarded work', async () => {
    // Our message is on the server, the answer has not landed, AND the server says the run
    // is alive. Only now is "läuft zu Ende" a report rather than a hope. Telling the founder
    // to "send it again" here would duplicate a turn they have already paid for.
    const server = { transcript: () => [userMsg()], turnStatus: () => RUNNING };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('still-running');
    expect(s.state.sendFailed).toBe(false);
    expect(s.state.error).toMatch(/läuft auf dem Server zu Ende/);
  });

  // ── THE FOUNDER'S CASE ──────────────────────────────────────────────────────
  //
  // Server-side proof that this is what actually happened lives in the API suite
  // (chat-sessions-runtime-abort.test.ts): after a lock-screen turn that outruns
  // CHAT_MAX_RUNTIME_MS, NO assistant row is written. The transcript below is therefore
  // exactly what the founder's device saw — his message, and nothing after it.
  it('a turn the runtime guard discarded is NEVER called pending', async () => {
    const server = { transcript: () => [userMsg()], turnStatus: () => LOST_MAX_RUNTIME };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('lost');
    // The sentence he waited on must not appear for this state, in either language.
    for (const lang of ['de', 'en'] as const) {
      expect(recoveryMessage('lost', lang) ?? '').not.toMatch(/zu Ende|finishes on the server|nochmal auf|reopen this chat/i);
    }
    expect(s.state.error).toMatch(/ging verloren/);
    // And it is actionable: one tap re-runs the original prompt.
    expect(s.state.sendFailed).toBe(true);
  });

  it('an unaccountable turn admits the uncertainty instead of rounding it up', async () => {
    // Our message is on the server, no answer, and the server has no record of the turn
    // (restart / other replica). "läuft weiter" would be the same false claim in a new
    // place. The old code returned exactly that.
    const server = { transcript: () => [userMsg()], turnStatus: () => NO_RECORD };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('indeterminate');
    expect(s.state.error).toMatch(/kann nicht feststellen/);
    expect(s.state.sendFailed).toBe(true);
  });

  it('a failed status read is "could not ask", not "nothing is running"', async () => {
    const server = { transcript: () => [userMsg()], turnStatus: () => null };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('indeterminate');
    expect(outcome?.kind).not.toBe('still-running');
  });

  it('"läuft weiter" is reachable ONLY through a verified running state', async () => {
    // Every unverified shape of the status must fail to produce that claim.
    const unverified: Array<TurnStatus | null> = [
      null,
      NO_RECORD,
      { state: 'running', reason: null, verified: false }, // verified:false is not a licence
      { state: 'completed', reason: null, verified: true }, // completed but no visible answer
    ];
    for (const status of unverified) {
      const s = makeSurface({ transcript: () => [userMsg()], turnStatus: () => status });
      s.send();
      s.advance(60_000);
      const outcome = await s.returned(60_000);
      expect(outcome?.kind).not.toBe('still-running');
    }
  });

  it('an unreachable server is admitted, not dressed up as a finished turn', async () => {
    const server = { transcript: () => null };
    const s = makeSurface(server);

    s.send();
    s.advance(60_000);
    const outcome = await s.returned(60_000);

    expect(outcome?.kind).toBe('unreachable');
    expect(s.state.messages).toHaveLength(1); // nothing invented
    expect(s.state.error).toMatch(/nicht erreichbar/);
  });

  it('no outcome tells the user to retry work the server is holding', () => {
    for (const kind of ['answered', 'still-running', 'unreachable', 'stream-alive'] as const) {
      expect(offersResend(kind)).toBe(false);
    }
    // A turn with no saved answer and none coming: the resend is the only route to one.
    for (const kind of ['never-arrived', 'lost', 'indeterminate'] as const) {
      expect(offersResend(kind)).toBe(true);
    }
    // The vague line is gone from every reachable state, in both languages.
    for (const lang of ['de', 'en'] as const) {
      for (const kind of ['answered', 'still-running', 'never-arrived', 'lost', 'indeterminate', 'unreachable', 'stream-alive'] as const) {
        expect(recoveryMessage(kind, lang) ?? '').not.toMatch(/kurz gehakt|hiccup/i);
      }
    }
  });

  it('every retryable state has its own label — none claims "wartet auf Verbindung" falsely', () => {
    for (const lang of ['de', 'en'] as const) {
      // A turn that reached the server and was discarded is not waiting for a connection.
      expect(resendHint('lost', lang)).not.toMatch(/Verbindung|connection/i);
      expect(resendHint('indeterminate', lang)).not.toMatch(/Verbindung|connection/i);
      // An undelivered message genuinely is.
      expect(resendHint('never-arrived', lang)).toMatch(/Verbindung|connection/i);
      // And a lost turn is re-STARTED, not re-sent — the message itself already arrived.
      expect(resendActionLabel('lost', lang)).toMatch(/neu starten|start again/);
      expect(resendActionLabel('never-arrived', lang)).toMatch(/erneut senden|send again/);
    }
  });

  it('both languages exist for every outcome that speaks', () => {
    for (const kind of ['still-running', 'lost', 'indeterminate', 'never-arrived', 'unreachable'] as const) {
      const de = recoveryMessage(kind, 'de');
      const en = recoveryMessage(kind, 'en');
      expect(de).toBeTruthy();
      expect(en).toBeTruthy();
      expect(de).not.toBe(en);
    }
  });

  it('the checking line promises nothing while it looks', () => {
    expect(checkingMessage('de')).toMatch(/prüfe/);
    expect(checkingMessage('en')).toMatch(/checking/);
  });
});

// ─── The live stream must not be collateral damage ────────────────────────────

describe('a healthy stream is left alone', () => {
  it('a brief flick to the app switcher does not ask the server', () => {
    expect(shouldAskServerOnReturn({ unresolved: true, hiddenForMs: 400, quietForMs: 200 })).toBe(false);
  });

  it('a settled, resolved chat never asks', () => {
    expect(shouldAskServerOnReturn({ unresolved: false, hiddenForMs: 60_000, quietForMs: null })).toBe(false);
  });

  it('a stream that woke up mid-recovery is handed back untouched', async () => {
    // A slow first token (model thinking) can look quiet enough to ask about. The recovery
    // must notice the stream is alive and back off rather than declare the turn lost.
    const server = { transcript: () => [userMsg()] };
    const s = makeSurface(server);

    s.send();
    s.advance(10_000); // 10s of silence before the first token
    const pending = s.returned(400);
    s.advance(10);
    expect(s.delta()).toBe(true); // a token arrives during the recovery

    const outcome = await pending;
    expect(outcome?.kind).toBe('stream-alive');
    expect(s.state.error).toBeNull();
    expect(s.state.streaming).toBe(true); // untouched
    // The turn was NOT retired, so its own `done` can still land.
    expect(s.guard.mayFinish(1)).toBe(true);
  });

  it('quietness alone decides when there is no hide measurement to fall back on', () => {
    expect(shouldAskServerOnReturn({ unresolved: true, hiddenForMs: null, quietForMs: SUSPEND_SUSPECT_MS })).toBe(true);
    expect(shouldAskServerOnReturn({ unresolved: true, hiddenForMs: null, quietForMs: SUSPEND_SUSPECT_MS - 1 })).toBe(false);
    // No stream at all (already failed) — only the server can resolve it.
    expect(shouldAskServerOnReturn({ unresolved: true, hiddenForMs: null, quietForMs: null })).toBe(true);
  });
});

// ─── The guard, on its own ────────────────────────────────────────────────────

describe('turn guard — who owns the screen', () => {
  it('refuses a superseded turn its terminal write, forever', () => {
    const g = createTurnGuard();
    const e = g.begin();
    expect(g.mayFinish(e)).toBe(true);

    g.beginRecovery();
    expect(g.mayFinish(e)).toBe(false);
    expect(g.mayStream(e)).toBe(true); // a delta is still evidence, and still welcome

    g.endRecovery(true);
    expect(g.mayFinish(e)).toBe(false);
    expect(g.mayStream(e)).toBe(false);
  });

  it('gives the turn back when the recovery backed off', () => {
    const g = createTurnGuard();
    const e = g.begin();
    g.beginRecovery();
    g.endRecovery(false);
    expect(g.mayFinish(e)).toBe(true);
  });

  it('an older turn can never write over a newer one', () => {
    const g = createTurnGuard();
    const first = g.begin();
    const second = g.begin();
    expect(g.mayFinish(first)).toBe(false);
    expect(g.mayFinish(second)).toBe(true);
  });
});

// ─── Bounds ───────────────────────────────────────────────────────────────────

describe('recoverTurn bounds its own waiting', () => {
  it('looks a bounded number of times and sleeps between looks, not after the last', async () => {
    const fetchTranscript = vi.fn(async () => [userMsg()]);
    const sleep = vi.fn(async () => {});
    const outcome = await recoverTurn({
      prompt: PROMPT, fetchTranscript, fetchTurnStatus: async () => RUNNING,
      streamAlive: () => false, sleep,
    });
    expect(outcome.kind).toBe('still-running');
    expect(fetchTranscript).toHaveBeenCalledTimes(RECOVERY_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(RECOVERY_ATTEMPTS - 1);
  });

  it('adopts as soon as the answer lands, without burning the remaining looks', async () => {
    let calls = 0;
    const fetchTranscript = vi.fn(async () => (++calls < 3 ? [userMsg()] : [userMsg(), assistantMsg()]));
    const outcome = await recoverTurn({
      prompt: PROMPT, fetchTranscript, fetchTurnStatus: async () => RUNNING,
      streamAlive: () => false, sleep: async () => {},
    });
    expect(outcome.kind).toBe('answered');
    expect(fetchTranscript).toHaveBeenCalledTimes(3);
  });

  it('does not mistake an earlier turn\'s answer for this turn\'s', async () => {
    // A trailing assistant row with OUR message absent means the send never arrived —
    // adopting here would show the founder a stale answer as if it were the new one.
    const outcome = await recoverTurn({
      prompt: PROMPT,
      fetchTranscript: async () => [userMsg('eine ganz andere Frage'), assistantMsg('alte Antwort')],
      fetchTurnStatus: async () => NO_RECORD,
      streamAlive: () => false,
      sleep: async () => {},
    });
    expect(outcome.kind).toBe('never-arrived');
  });
});
