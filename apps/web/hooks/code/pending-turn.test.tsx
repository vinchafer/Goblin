// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U5 (D-B) — the user's turn disappeared from the Code-tab chat.
 *
 * The founder, 2026-08-18: "dann im chat im coding tab geschrieben, stell mir das
 * live - meine nachricht war gleich nicht mehr sichtbar."
 *
 * WHAT THIS UNIT DOES AND DOES NOT CLAIM. The exact trigger is recorded as
 * UNRESOLVED in docs/BUILDER_FLOW_DIAGNOSIS_2026_08_18.md §3 — I could not
 * determine which refresh dropped the turn, and I ruled out three candidates
 * (server-side persistence, the thread's collapse rule, and a regression of the
 * standalone-chat lock-screen fix, which is a different code path entirely). What IS
 * established is the structural exposure: the Code tab had NO optimistic user turn
 * at all, so the presence of your own sentence depended entirely on a network round
 * trip, and any path that replaced `messages` could take it away.
 *
 * These tests pin the contract instead of a guessed cause: a turn the user sent
 * survives every refresh — including one that fails, and one that comes back
 * without it — and retires only when the server's own copy arrives.
 *
 * FALSIFICATION: `addPendingUserTurn` / `mergePendingTurns` did not exist; the
 * pre-fix `refresh` did `setMessages(data.messages ?? [])` unconditionally. 4/4
 * fail without the fix.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCodeSessionDetail, mergePendingTurns, type SessionMessage } from './useCodeSessionDetail';

vi.mock('./getToken', () => ({
  getToken: vi.fn(async () => 'test-token'),
  API_URL: 'https://api.test',
}));

const PROMPT = 'stell mir das live';

function serverMessage(id: string, role: 'user' | 'assistant', content: string): SessionMessage {
  return { id, role, content, model_used: null, state: 'complete', created_at: '2026-08-18T09:00:00Z' };
}

function ok(body: unknown): Response {
  return {
    ok: true, status: 200,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

describe('mergePendingTurns — the rule, pinned directly', () => {
  it('keeps a turn the server thread does not contain', () => {
    const pending = { current: [serverMessage('local-1', 'user', PROMPT)] };
    const merged = mergePendingTurns([serverMessage('s1', 'assistant', 'ok')], pending);

    expect(merged.map(m => m.content)).toContain(PROMPT);
    expect(pending.current).toHaveLength(1);
  });

  it('retires a turn once the server sends its own copy — no duplicate bubble', () => {
    const pending = { current: [serverMessage('local-1', 'user', PROMPT)] };
    const merged = mergePendingTurns(
      [serverMessage('s1', 'user', PROMPT), serverMessage('s2', 'assistant', 'ok')],
      pending,
    );

    expect(merged.filter(m => m.content === PROMPT)).toHaveLength(1);
    expect(merged[0]!.id).toBe('s1');
    expect(pending.current).toHaveLength(0);
  });
});

describe('useCodeSessionDetail — a sent turn survives the round trip (D-B)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a refresh that comes back WITHOUT the turn does not take it off screen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ files: [], messages: [], filesComplete: true })));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addPendingUserTurn(PROMPT));
    expect(result.current.messages.map(m => m.content)).toContain(PROMPT);

    // The server has not persisted (or not yet returned) the turn. Before this unit
    // that response replaced `messages` wholesale and the bubble vanished — exactly
    // what the founder saw.
    await act(async () => { await result.current.refresh(); });
    expect(result.current.messages.map(m => m.content)).toContain(PROMPT);
  });

  it('a FAILED refresh does not take it off screen either', async () => {
    let first = true;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (first) { first = false; return ok({ files: [], messages: [], filesComplete: true }); }
      return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) } as unknown as Response;
    }));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addPendingUserTurn(PROMPT));
    await act(async () => { await result.current.refresh(); });

    expect(result.current.loadError).toEqual({ kind: 'http', status: 500 });
    expect(result.current.messages.map(m => m.content)).toContain(PROMPT);
  });
});

/**
 * U5b (D-B) — the guarantee must not be silent.
 *
 * Founder, on merging PR #107: "does the U5 symptom guarantee leave a log line when
 * it fires? If not, a silent guarantee makes D-B undiagnosable."
 *
 * He is right, and it is the sharper version of the original problem. U5 keeps the
 * message on screen, which is what the user needs — but D-B's root cause is recorded
 * as UNRESOLVED, and the only moment that could ever resolve it is exactly the moment
 * the guarantee fires: a refresh that came back without a turn the user sent. If that
 * moment passes in silence, the fix hides its own evidence.
 *
 * FALSIFICATION: `mergePendingTurns` took no callback and the hook logged nothing.
 * 3/4 fail without this commit. The fourth ("stays silent when the server DID
 * acknowledge") is green before and after on purpose: it is the guard against the
 * lazy version of this fix, which would warn on every refresh and teach the founder
 * to ignore the line.
 */
describe('U5b — a firing guarantee reports itself', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mergePendingTurns calls back with the turns it had to keep', () => {
    const pending = { current: [serverMessage('local-1', 'user', PROMPT)] };
    const kept: SessionMessage[][] = [];
    mergePendingTurns([serverMessage('s1', 'assistant', 'ok')], pending, (k) => kept.push(k));

    expect(kept).toHaveLength(1);
    expect(kept[0]!.map(m => m.content)).toEqual([PROMPT]);
  });

  it('stays silent when the server DID acknowledge — no noise on the happy path', () => {
    const pending = { current: [serverMessage('local-1', 'user', PROMPT)] };
    const kept: SessionMessage[][] = [];
    mergePendingTurns([serverMessage('s1', 'user', PROMPT)], pending, (k) => kept.push(k));

    expect(kept).toHaveLength(0);
  });

  it('the hook warns, and names the session, the age and how many refreshes it survived', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ok({ files: [], messages: [], filesComplete: true })));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addPendingUserTurn(PROMPT));
    await act(async () => { await result.current.refresh(); });

    const call = warn.mock.calls.find(([msg]) => String(msg).includes('not acknowledged'));
    expect(call, 'the guarantee fired without leaving a log line').toBeDefined();
    const payload = call![1] as Record<string, unknown>;
    expect(payload.sessionId).toBe('sess-1');
    expect(payload.survivedRefreshes).toBe(1);
    expect(payload.preview).toBe(PROMPT);
    // One survival can be a race with the server's own insert; it is not yet D-B.
    expect(payload.likelyDefect).toBe(false);
    warn.mockRestore();
  });

  it('a turn surviving a SECOND refresh is marked as the defect, not a race', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ok({ files: [], messages: [], filesComplete: true })));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addPendingUserTurn(PROMPT));
    await act(async () => { await result.current.refresh(); });
    await act(async () => { await result.current.refresh(); });

    const calls = warn.mock.calls.filter(([msg]) => String(msg).includes('not acknowledged'));
    const last = calls[calls.length - 1]![1] as Record<string, unknown>;
    expect(last.survivedRefreshes).toBe(2);
    expect(last.likelyDefect).toBe(true);
    warn.mockRestore();
  });
});
