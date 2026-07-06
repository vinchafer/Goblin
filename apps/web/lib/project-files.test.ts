// P1.7 — M2 badge hardening (429). Verifies that the badge base loader tolerates
// the per-file rate limiter: a base that 429s once/twice then succeeds resolves
// correctly (file NOT mislabeled NEU), and a base that 429s past the retry budget
// is reported as *unknown* (not asserted-new).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAllTextFilesWithStatus } from './project-files';
import { classifyCard } from '@/components/code/FileCardList';
import type { SessionFile } from '@/hooks/code/useCodeSessionDetail';

// authHeader dynamically imports the supabase client — stub it so the loader has
// a token and proceeds to the fetch layer we actually want to exercise.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  }),
}));

const PROJECT = 'proj-1';
const FILES = ['stable.html', 'flaky.css', 'doomed.js'];

// Per-path count of how many 429s to emit before the first 200.
let failuresLeft: Record<string, number>;
const CONTENT: Record<string, string> = {
  'stable.html': '<h1>hello</h1>',
  'flaky.css': 'body{margin:0}',
  'doomed.js': 'console.log(1)',
};

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    // List endpoint: exactly `/files` (no trailing path segment).
    if (/\/projects\/[^/]+\/files$/.test(url)) return jsonRes({ files: FILES });
    // Per-file content endpoint.
    const m = url.match(/\/files\/(.+)$/);
    if (m) {
      const path = decodeURIComponent(m[1]);
      if ((failuresLeft[path] ?? 0) > 0) {
        failuresLeft[path]--;
        return jsonRes({ error: 'rate limited' }, 429, { 'Retry-After': '0' });
      }
      return jsonRes({ content: CONTENT[path] });
    }
    return jsonRes({ error: 'not found' }, 404);
  });
});

afterEach(() => vi.restoreAllMocks());

const draft = (path: string, content: string): SessionFile => ({
  id: path, path, content, change_state: 'draft', updated_at: '',
});

describe('fetchAllTextFilesWithStatus — 429 hardening', () => {
  it('resolves a base that 429s once or twice then succeeds (no permanent NEU)', async () => {
    failuresLeft = { 'stable.html': 0, 'flaky.css': 2, 'doomed.js': 1 };

    const res = await fetchAllTextFilesWithStatus(PROJECT);

    // All three eventually resolve within the retry budget.
    expect(res.files['stable.html']).toBe(CONTENT['stable.html']);
    expect(res.files['flaky.css']).toBe(CONTENT['flaky.css']);
    expect(res.files['doomed.js']).toBe(CONTENT['doomed.js']);
    expect(res.unknownPaths.size).toBe(0);

    // A draft whose content equals the (now-resolved) base is IDENTICAL, not NEU.
    const card = classifyCard(draft('flaky.css', CONTENT['flaky.css']), res.files, res.unknownPaths);
    expect(card.status).not.toBe('new');
    expect(card.status).toBe('none');
  });

  it('reports an unknown (not NEU) base when 429s exceed the retry budget', async () => {
    // MAX_RETRIES=3 → 4 attempts; 5 forced 429s can never succeed.
    failuresLeft = { 'stable.html': 0, 'flaky.css': 0, 'doomed.js': 5 };

    const res = await fetchAllTextFilesWithStatus(PROJECT);

    // The doomed file has no resolved base and is flagged unknown.
    expect(res.files['doomed.js']).toBeUndefined();
    expect(res.unknownPaths.has('doomed.js')).toBe(true);

    // Guardrail: a draft with an unknown base must NOT render a confident NEU.
    const card = classifyCard(draft('doomed.js', CONTENT['doomed.js']), res.files, res.unknownPaths);
    expect(card.status).not.toBe('new');
    expect(card.status).toBe('none');

    // Contrast: a draft that is genuinely absent from the project IS new.
    const absent = classifyCard(draft('brand-new.html', 'x'), res.files, res.unknownPaths);
    expect(absent.status).toBe('new');
  });
});
