// @vitest-environment jsdom
/**
 * FOUNDER-WALK-6 · U5 (F1) — a project switch must not offer or write into
 * another project's session.
 *
 * The founder opened a NEW project, sent a prompt, and the session picker
 * offered a session belonging to a DIFFERENT project of his — because this
 * hook's instance survives a project switch (the Code tab does a soft client
 * navigation, no remount) and `refresh()` only ever overwrote `sessions` on a
 * SUCCESSFUL response, never clearing it first. So immediately after switching
 * projects, `sessions`/`loading` still described the PREVIOUS project until the
 * new fetch resolved — a window in which a picker reading this hook's state
 * would offer the wrong project's sessions.
 *
 * This test proves the fix at the point that actually matters: the instant
 * after a `projectId` prop change, BEFORE the new project's fetch has had any
 * chance to resolve.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCodeSessions } from './useCodeSessions';

vi.mock('./getToken', () => ({
  getToken: vi.fn(async () => 'test-token'),
  API_URL: 'https://api.test',
}));

function session(id: string, name: string) {
  return { id, name, model_id: null, state: 'active' as const, created_at: '2026-08-15T00:00:00Z', updated_at: '2026-08-15T00:00:00Z', draftCount: 0 };
}

const P1_SESSIONS = [session('p1-s1', 'Projekt 1 — Session A'), session('p1-s2', 'Projekt 1 — Session B')];
const P2_SESSIONS = [session('p2-s1', 'Projekt 2 — Session A')];

describe('useCodeSessions — resets on a project switch (founder-walk-6 U5/F1)', () => {
  let resolvers: Array<() => void> = [];

  beforeEach(() => {
    resolvers = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const projectId = new URL(url).searchParams.get('projectId');
        return new Promise((resolve) => {
          resolvers.push(() =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ sessions: projectId === 'p1' ? P1_SESSIONS : projectId === 'p2' ? P2_SESSIONS : [] }),
            } as Response),
          );
        });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('never exposes the previous project\'s sessions while the new project\'s fetch is in flight', async () => {
    const { result, rerender } = renderHook(({ projectId }) => useCodeSessions(projectId), { initialProps: { projectId: 'p1' } });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
    await act(async () => { resolvers.pop()!(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual(P1_SESSIONS);

    // The project switch — CodeWorkspace/CodeTab are NOT remounted (soft nav),
    // so this is the same hook instance, just handed a new `projectId`.
    rerender({ projectId: 'p2' });

    // THE ASSERTION THAT MATTERS: synchronously after the switch, before p2's
    // fetch has resolved (or even been awaited here), the hook must already
    // have thrown away p1's sessions rather than still describing them.
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.activeSessionId).toBeNull();

    await waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
    await act(async () => { resolvers.pop()!(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual(P2_SESSIONS);
    // Never P1's — the exact cross-project leak the picker exposed.
    expect(result.current.sessions.some((s) => s.id.startsWith('p1-'))).toBe(false);
  });

  it('a refresh() for the SAME project does not flash the list to empty', async () => {
    const { result } = renderHook(({ projectId }) => useCodeSessions(projectId), { initialProps: { projectId: 'p1' } });
    await waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
    await act(async () => { resolvers.pop()!(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual(P1_SESSIONS);

    // A same-project refresh (e.g. after creating a session) must not reset —
    // only an actual PROJECT change should ever clear the list synchronously.
    act(() => { void result.current.refresh(); });
    expect(result.current.sessions).toEqual(P1_SESSIONS);
    expect(result.current.loading).toBe(false);

    await waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
    await act(async () => { resolvers.pop()!(); });
  });
});
