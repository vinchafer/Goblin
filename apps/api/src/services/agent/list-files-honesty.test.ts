/**
 * FOUNDER-WALK-7 · U3 (D-C) — "keine Dateien" for a project that has files.
 *
 * The founder's walk, 2026-08-18. The agent's step block read:
 *   "Ich lese erst einmal die Projektdateien, um zu sehen, was bisher gebaut wurde…"
 *   → "keine Dateien · 114ms"
 * for a project that demonstrably contained the built landing page. The step was
 * rendered as SUCCESSFUL, so nothing downstream — not the model, not the report,
 * not the UI — had any reason to doubt it, and every answer from there on was built
 * on an emptiness nobody had established.
 *
 * Root cause: `listSessionPaths` destructured only `data` and returned `data ?? []`.
 * A failed query and an empty project produced byte-identical results, and
 * `toolListFiles` announced both as `ok: true, summary: 'keine Dateien'`.
 *
 * The property under test is the distinction itself: an unresolved listing is an
 * ERROR, a resolved empty listing is still a success, and the two do not collapse.
 * Both directions matter — a fix that called every empty project a failure would
 * lie in the other direction.
 *
 * FALSIFICATION: on the pre-fix code the failing-query case returns
 * `{ ok: true, summary: 'keine Dateien' }`. 2/4 fail without the fix (the two that
 * assert the failure is visible); the two happy-path cases pass before and after,
 * which is the point — they are the guard against over-correction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Set to a message to make the code_session_files listing query fail. */
let listError: string | null = null;
/** The rows the listing query resolves to when it succeeds. */
let listRows: Array<{ path: string }> = [];

vi.mock('../../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: async () => (listError ? { data: null, error: { message: listError } } : { data: listRows, error: null }),
      }),
    }),
  }),
}));

async function listFilesResult() {
  const { buildToolExecutor } = await import('./tools');
  // The executor takes the Supabase client explicitly; the module mock above is what
  // its default argument resolves to, so the real toolListFiles runs against the
  // stubbed query result.
  const exec = buildToolExecutor();
  return exec(
    { name: 'list_files', args: {} } as Parameters<ReturnType<typeof buildToolExecutor>>[0],
    { sessionId: 'sess-1', projectId: 'proj-1', userId: 'user-1' } as Parameters<ReturnType<typeof buildToolExecutor>>[1],
  );
}

describe('list_files — an unresolved listing is never reported as an empty project', () => {
  beforeEach(() => {
    listError = null;
    listRows = [];
  });

  it('a FAILED listing query is a failed step, not "keine Dateien"', async () => {
    listError = 'connection terminated unexpectedly';
    const r = await listFilesResult();

    expect(r.ok).toBe(false);
    expect(r.summary).not.toContain('keine Dateien');
    expect(r.error?.code).toBe('listing_unavailable');
  });

  it('the failure tells the model, in German, NOT to assume the project is empty', async () => {
    listError = 'statement timeout';
    const r = await listFilesResult();

    const message = r.error?.message ?? '';
    // The whole defect was the model proceeding as if the project were empty. The
    // error has to say that explicitly, or the model draws the same conclusion from
    // a bare failure that it drew from the bare empty list.
    expect(message).toMatch(/nicht gelesen werden/);
    expect(message).toMatch(/NICHT.*leer|nicht.*leer/);
    // Honest error, not a raw driver string in front of anyone.
    expect(message).not.toContain('statement timeout');
  });

  it('a project that really IS empty still reports "keine Dateien" as a success', async () => {
    listRows = [];
    const r = await listFilesResult();

    expect(r.ok).toBe(true);
    expect(r.summary).toBe('keine Dateien');
    expect(r.data).toEqual([]);
  });

  it('a project with files reports the count, unchanged', async () => {
    listRows = [{ path: 'index.html' }, { path: 'style.css' }];
    const r = await listFilesResult();

    expect(r.ok).toBe(true);
    expect(r.summary).toBe('2 Dateien');
    expect(r.data).toEqual(['index.html', 'style.css']);
  });
});
