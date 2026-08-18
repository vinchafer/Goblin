/**
 * FOUNDER-WALK-7 · U2 (D-A) — POST /api/code-sessions must not announce a draft it
 * did not write.
 *
 * The founder's walk, 2026-08-18: "An Code senden" opened the Code tab, the session
 * tab appeared with the right title, the pane was empty, and ten clicks produced
 * nothing. The session row is created by one Supabase call and the Send-to-Code
 * draft by a SECOND one — and the second one's result was discarded:
 *
 *     await sb.from('code_session_files').insert({ … });          // result dropped
 *     return c.json({ session: { …session, draftCount: initialContent ? 1 : 0 } }, 201);
 *                                          ^ a count derived from the REQUEST
 *
 * So a failed write returned 201 with draftCount 1. The tab rendered, the draft dot
 * rendered, the session was empty, and nothing in the system could tell. That is the
 * Feeling-Invariant violation at the heart of D-A: asserting a state that was never
 * verified.
 *
 * The property under test is not "insert was called". It is "what the response SAYS
 * matches what the database DID" — in both directions, because a fix that always
 * reports failure would be just as dishonest.
 *
 * FALSIFICATION: on the pre-fix handler the failing case returns draftCount 1 and no
 * `initialFile` at all. 3/3 fail without the fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// The auth middleware is not what is under test — stand in for it so the handler
// runs with a known principal.
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
}));

/** Set to a message to make the code_session_files insert fail. */
let fileInsertError: string | null = null;
/** Every row the handler tried to write into code_session_files. */
let attemptedFileRows: Array<Record<string, unknown>> = [];

const SESSION_ROW = {
  id: 'sess-1',
  name: 'Bau mir eine einfache Kontaktseite',
  model_id: null,
  state: 'active',
  created_at: '2026-08-18T09:00:00Z',
  updated_at: '2026-08-18T09:00:00Z',
};

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      if (table === 'projects') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'proj-1', name: 'Gitarrenunterricht' } }) }) }) }),
        };
      }
      if (table === 'code_sessions') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: SESSION_ROW, error: null }) }) }),
        };
      }
      if (table === 'code_session_files') {
        return {
          insert: async (row: Record<string, unknown>) => {
            attemptedFileRows.push(row);
            return fileInsertError ? { error: { message: fileInsertError } } : { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

async function post(body: unknown) {
  const { codeSessions } = await import('./code-sessions');
  const app = new Hono().route('/api/code-sessions', codeSessions);
  return app.request('/api/code-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const PAYLOAD = {
  projectId: '11111111-1111-4111-8111-111111111111',
  name: 'Bau mir eine einfache Kontaktseite',
  initialContent: '<!doctype html><html><body><form>…</form></body></html>',
  initialFilename: 'index.html',
};

describe('POST /api/code-sessions — the Send-to-Code draft is reported, not assumed', () => {
  beforeEach(() => {
    fileInsertError = null;
    attemptedFileRows = [];
  });

  it('a draft that FAILED to write is reported as not landed, and the count says 0', async () => {
    fileInsertError = 'duplicate key value violates unique constraint';
    const res = await post(PAYLOAD);
    const body = await res.json();

    // The session itself was created, so 201 is still the truthful status — this is
    // not "the request was bad", it is "part of it did not happen".
    expect(res.status).toBe(201);
    expect(attemptedFileRows).toHaveLength(1);

    // The two assertions D-A turned on.
    expect(body.session.draftCount).toBe(0);
    expect(body.initialFile).toEqual({ requested: true, landed: false, path: 'index.html' });
  });

  it('a draft that DID write is reported as landed — the fix is not "always claim failure"', async () => {
    const res = await post(PAYLOAD);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.session.draftCount).toBe(1);
    expect(body.initialFile).toEqual({ requested: true, landed: true, path: 'index.html' });
  });

  it('a create with no payload says so explicitly rather than leaving it to be inferred', async () => {
    const res = await post({ projectId: PAYLOAD.projectId, name: 'Neue Session' });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(attemptedFileRows).toHaveLength(0);
    expect(body.session.draftCount).toBe(0);
    expect(body.initialFile).toEqual({ requested: false, landed: false, path: null });
  });
});
