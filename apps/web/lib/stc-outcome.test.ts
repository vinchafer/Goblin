// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U2 (D-A) — "An Code senden" opens the tab and the session is empty.
 *
 * The founder, live on production, 2026-08-18:
 *   "das codefenster macht nicht, ich klicke oben auf den tab und nichts passiert…
 *    ich klicke 10 mal auf die session aber sie geht nicht auf"
 *
 * The session HAD opened. It was empty, and an empty session that was supposed to
 * receive code looked exactly like a session nobody had put anything in yet — a
 * blank thread and "Noch keine Dateien", with no error anywhere. The server had
 * announced `draftCount: initialContent ? 1 : 0` (a number derived from the REQUEST,
 * not from the write) and the client had no way to ask whether the draft was real.
 *
 * These tests pin the property that closes D-A: a routed payload that did not land
 * is DISTINGUISHABLE from a session that is legitimately empty, and it produces a
 * message that says what did not happen — without naming a cause the client did not
 * establish, and without predicting that a retry will work.
 *
 * FALSIFICATION: the whole `initialFile` channel did not exist before this unit
 * (`createSession` returned only the session row, POST reported an unverified
 * count), so every "did not land" case below resolves to `landed`/no notice on the
 * pre-fix code. 6/6 fail without the fix.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { classifyStcOutcome, stcNeedsNotice, stcNoticeText } from './stc-outcome';
import { useCodeSessions, type CreateSessionResult } from '@/hooks/code/useCodeSessions';

vi.mock('@/hooks/code/getToken', () => ({
  getToken: vi.fn(async () => 'test-token'),
  API_URL: 'https://api.test',
}));

const SESSION = {
  id: 's1',
  name: 'Bau mir eine einfache Kontaktseite',
  model_id: null,
  state: 'active' as const,
  created_at: '2026-08-18T09:00:00Z',
  updated_at: '2026-08-18T09:00:00Z',
  draftCount: 0,
};

describe('classifyStcOutcome — the founder-walk case, at the seam that decides', () => {
  it('a session created with a payload that did NOT land is not "landed"', () => {
    const result = {
      ...SESSION,
      initialFile: { requested: true, landed: false, path: 'index.html' },
    } as CreateSessionResult;
    const outcome = classifyStcOutcome(result, 'index.html');
    expect(outcome.kind).toBe('no-file');
    expect(stcNeedsNotice(outcome)).toBe(true);
  });

  it('a session that could not be created at all is its own, distinct outcome', () => {
    const outcome = classifyStcOutcome(null, 'index.html');
    expect(outcome.kind).toBe('no-session');
    expect(stcNeedsNotice(outcome)).toBe(true);
  });

  it('a payload that DID land says nothing — no notice on the happy path', () => {
    const result = {
      ...SESSION,
      draftCount: 1,
      initialFile: { requested: true, landed: true, path: 'index.html' },
    } as CreateSessionResult;
    expect(classifyStcOutcome(result, 'index.html').kind).toBe('landed');
    expect(stcNeedsNotice(classifyStcOutcome(result, 'index.html'))).toBe(false);
  });

  it('an ordinary "Neue Session" (no payload requested) never shows the notice', () => {
    const result = {
      ...SESSION,
      initialFile: { requested: false, landed: false, path: null },
    } as CreateSessionResult;
    expect(stcNeedsNotice(classifyStcOutcome(result, null))).toBe(false);
  });

  it('the notice states what did not happen — no invented cause, no invented timeline', () => {
    const text = stcNoticeText(classifyStcOutcome(null, 'index.html'))!;
    const all = `${text.headline} ${text.detail}`;
    expect(text.headline).toContain('nicht angelegt');
    // The exact failure D-F1 is about, guarded here too: never assert the server is
    // down, and never promise that trying again shortly will work.
    expect(all).not.toMatch(/Server|erreichbar|gleich nochmal|in Kürze|kurz warten/i);
    // Never a raw payload or a stack trace in front of the user.
    expect(all).not.toMatch(/Error|undefined|null|\bat \w+\.tsx?:/);
  });
});

describe('useCodeSessions.createSession — carries the server\'s answer, not an assumption', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('surfaces initialFile.landed === false so the caller can tell the payload was lost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              // Exactly the shape the fixed POST returns when the draft insert failed:
              // the session exists, the count is honest, and the outcome is explicit.
              session: SESSION,
              initialFile: { requested: true, landed: false, path: 'index.html' },
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ sessions: [] }) } as Response;
      }),
    );

    const { result } = renderHook(() => useCodeSessions('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const created = await result.current.createSession({
      initialContent: '<html>…</html>',
      initialFilename: 'index.html',
      name: 'Bau mir eine einfache Kontaktseite',
    });

    expect(created).not.toBeNull();
    expect(created!.initialFile).toEqual({ requested: true, landed: false, path: 'index.html' });
    expect(classifyStcOutcome(created, 'index.html').kind).toBe('no-file');
  });
});
