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
