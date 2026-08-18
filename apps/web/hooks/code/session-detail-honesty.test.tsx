// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U4 (D-D) — the editor showed the built code only after leaving
 * the project and coming back.
 *
 * The founder, 2026-08-18: "dann nochmals raus, zuerst in anderes projekt dann in
 * wieder ins richtige projekt und dann auf editor, erst dann kam der erarbeitete
 * code." First entry: "Noch keine Dateien". After a round trip: the files.
 *
 * The server hydrates the session from project storage BEFORE serving the GET
 * (code-sessions.ts), so a second request does nothing the first could not — which
 * rules out "hydration needs a second pass" and leaves only one explanation on the
 * client: the first request FAILED, and a failed request rendered as an empty
 * project.
 *
 *     if (!res.ok) { setLoading(false); return; }   // files stays [], nothing said
 *
 * Two properties are pinned here:
 *   1. a failed load is reported as a failure and does NOT masquerade as "no files"
 *   2. the transient 429 the Code-tab entry burst produces is retried before any
 *      conclusion is drawn — which is what makes the round trip unnecessary
 *
 * FALSIFICATION: `loadError` did not exist and no retry was attempted. 4/4 fail
 * without the fix.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCodeSessionDetail } from './useCodeSessionDetail';
import { sessionLoadNotice, surfaceStateFor } from '@/lib/session-load-state';

vi.mock('./getToken', () => ({
  getToken: vi.fn(async () => 'test-token'),
  API_URL: 'https://api.test',
}));

const FILES = [
  { id: 'f1', path: 'index.html', content: '<h1>Gitarrenunterricht</h1>', change_state: 'saved', updated_at: '2026-08-18T09:00:00Z' },
];

function response(init: { status: number; body?: unknown; retryAfter?: string }): Response {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: { get: (k: string) => (k === 'Retry-After' ? init.retryAfter ?? null : null) },
    json: async () => init.body ?? {},
  } as unknown as Response;
}

describe('useCodeSessionDetail — a failed load is not an empty project (D-D)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a 500 on first load reports loadError instead of leaving a silent empty file list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ status: 500 })));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.files).toEqual([]);
    expect(result.current.loadError).toEqual({ kind: 'http', status: 500 });
    // The distinction that matters on screen: the strip must not say "Noch keine
    // Dateien" about a session it could not read.
    expect(surfaceStateFor(result.current.loadError, 'empty')).toBe('unknown');
  });

  it('retries a transient 429 and then shows the real files — no round trip needed', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      // The Code-tab entry burst trips the API's 60/min general limit; the first
      // attempt is the one the founder hit.
      if (calls === 1) return response({ status: 429, retryAfter: '0' });
      return response({ status: 200, body: { files: FILES, messages: [], filesComplete: true } });
    }));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(result.current.files).toHaveLength(1);
    expect(result.current.loadError).toBeNull();
  });

  it('a successful load of a genuinely empty session stays "empty", not "unknown"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      response({ status: 200, body: { files: [], messages: [], filesComplete: true } })));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loadError).toBeNull();
    expect(surfaceStateFor(result.current.loadError, 'empty')).toBe('empty');
  });

  it('a partial hydrate is surfaced as incomplete — real files, honest caveat', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      response({ status: 200, body: { files: FILES, messages: [], filesComplete: false } })));

    const { result } = renderHook(() => useCodeSessionDetail('sess-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.files).toHaveLength(1);
    expect(result.current.loadError).toEqual({ kind: 'incomplete' });

    const notice = sessionLoadNotice(result.current.loadError)!;
    const all = `${notice.headline} ${notice.detail}`;
    // Honesty invariants: no invented cause, no invented timeline, no raw payload.
    expect(all).not.toMatch(/Server (ist|war) |gleich nochmal|in Kürze/i);
    expect(all).not.toMatch(/\bError\b|undefined|\bnull\b/);
  });
});
