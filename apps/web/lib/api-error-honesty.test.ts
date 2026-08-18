// @vitest-environment jsdom
/**
 * FOUNDER-WALK-7 · U7 (D-F1) — "Server kurz nicht erreichbar" was a diagnosis the
 * client had not made.
 *
 * The founder, 2026-08-18: "habe auf live stellen geklickt aber erhalte wieder
 * meldung server sind down… 4 mal geklickt." The sheet rendered, in red:
 *     "Server kurz nicht erreichbar – bitte gleich nochmal versuchen."
 *
 * That sentence asserts a CAUSE (the server is briefly unreachable) and a TIMELINE
 * (trying again shortly will work). The client established neither. What the server
 * had actually sent was a specific German sentence about his project — and
 * `friendlyError` dropped it, because the `status >= 500` branch stood ABOVE the
 * branch that reads the server's message, and `POST /api/ops/apps/publish` maps
 * almost every failure to 502/503.
 *
 * The timeline was the harmful half: it told him to repeat an action that could not
 * succeed by repetition. Four identical attempts is what that instruction looks like
 * from the inside.
 *
 * FALSIFICATION: 5/7 fail against the pre-fix `friendlyError` (the two that pass are
 * the sub-500 cases, which already preferred the server message and must keep
 * doing so).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// api.ts builds its own browser client lazily; stand in for it so the real
// `apiPost` (and therefore the real friendlyError) runs without Supabase env vars.
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 't' } }, error: null }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  }),
}));

function fail(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response;
}

async function messageFor(status: number, body: unknown): Promise<string> {
  const { apiPost } = await import('./api');
  vi.stubGlobal('fetch', vi.fn(async () => fail(status, body)));
  try {
    await apiPost('/api/ops/apps/publish', { projectId: 'p', name: 'gitarrenunterricht' });
    throw new Error('expected apiPost to reject');
  } catch (e) {
    return (e as Error).message;
  }
}

describe('friendlyError — the server\'s own sentence reaches the user (D-F1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a 502 carrying the API\'s German is NOT replaced by "Server kurz nicht erreichbar"', async () => {
    const german = 'In diesem Projekt liegen noch keine Dateien, die veröffentlicht werden könnten.';
    const msg = await messageFor(502, { error: 'empty_artifact', message: german });

    expect(msg).toBe(german);
    expect(msg).not.toContain('Server kurz nicht erreichbar');
  });

  it('a 503 carrying the API\'s German keeps it too', async () => {
    const german = 'Die Datenbank für deine App konnte nicht angelegt werden.';
    const msg = await messageFor(503, { error: 'd1_unavailable', message: german });
    expect(msg).toBe(german);
  });

  it('a 502 with no message states the status — it does not invent a cause or a timeline', async () => {
    const msg = await messageFor(502, {});

    expect(msg).toContain('502');
    // The two inventions, named:
    expect(msg).not.toMatch(/nicht erreichbar/);          // a cause
    expect(msg).not.toMatch(/gleich nochmal|in Kürze|kurz warten/); // a timeline
  });

  it('a framework placeholder body is treated as "no message", not as the server speaking', async () => {
    const msg = await messageFor(502, { message: 'Bad Gateway' });
    expect(msg).not.toBe('Bad Gateway');
    expect(msg).toContain('502');
  });

  it('a 403 no longer claims the session expired — that was a diagnosis, not a fact', async () => {
    const msg = await messageFor(403, {});
    expect(msg).not.toMatch(/Sitzung abgelaufen/);
  });

  it('a 422 refusal still passes the API\'s own German through, unchanged', async () => {
    const german = 'Diese Veröffentlichung wurde gestoppt.';
    const msg = await messageFor(422, { error: 'scan_blocked', message: german });
    expect(msg).toBe(german);
  });

  it('a 409 name conflict still passes the API\'s own German through, unchanged', async () => {
    const german = 'Dieser Name ist schon vergeben.';
    const msg = await messageFor(409, { error: 'name_taken', message: german });
    expect(msg).toBe(german);
  });
});
