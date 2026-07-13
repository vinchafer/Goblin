// FEEL-3a A3 gate: the five tools over an in-memory session store + mocked storage.
// Verifies each adapter's structured result and — critically — that write_file returns
// the REAL U2 classification (NEU / GEÄNDERT +n −m / IDENTISCH) that makes the report
// attestable, that read_file honors the U1 size cap with an honest "zu gross" error,
// that list_files excludes .trash, and that save_draft is idempotent.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── mocked storage layer (no B2/S3, no metering network) ───────────────────────
const storage = {
  getFile: vi.fn(async (_p: string, _path: string): Promise<string | null> => null),
  uploadFile: vi.fn(async () => 'ok'),
  headBytes: vi.fn(async () => 0),
};
vi.mock('../file-storage', () => ({
  getFile: (...a: unknown[]) => (storage.getFile as (...x: unknown[]) => unknown)(...a),
  uploadFile: (...a: unknown[]) => (storage.uploadFile as (...x: unknown[]) => unknown)(...a),
  headBytes: (...a: unknown[]) => (storage.headBytes as (...x: unknown[]) => unknown)(...a),
  // FEEL-3b: publish.ts (imported transitively via tools.ts) pulls listFiles/downloadFile.
  listFiles: vi.fn(async () => [] as string[]),
  downloadFile: vi.fn(async () => ''),
}));
vi.mock('../storage-usage', () => ({
  byteLen: (s: string) => Buffer.byteLength(s, 'utf8'),
  assertStorageRoom: vi.fn(async () => {}),
}));

// ── in-memory supabase fake for code_session_files ─────────────────────────────
type Row = Record<string, unknown>;
function matches(filters: Row) {
  return (r: Row) => Object.entries(filters).every(([k, v]) => r[k] === v);
}
function makeFakeSb(initial: Array<{ path: string; content: string; change_state?: string }>, sessionId: string) {
  let seq = 0;
  const rows: Row[] = initial.map((f) => ({
    id: `f${seq++}`,
    session_id: sessionId,
    user_id: 'u1',
    path: f.path,
    content: f.content,
    change_state: f.change_state ?? 'saved',
  }));
  const sb = {
    rows: () => rows,
    from(_table: string) {
      const filters: Row = {};
      const builder: Record<string, unknown> = {
        select() { return builder; },
        eq(col: string, val: unknown) { filters[col] = val; return builder; },
        maybeSingle() {
          const r = rows.find(matches(filters));
          return Promise.resolve({ data: r ? { ...r } : null, error: null });
        },
        upsert(row: Row) {
          const idx = rows.findIndex((x) => x.session_id === row.session_id && x.path === row.path);
          if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
          else rows.push({ id: `f${seq++}`, ...row });
          return Promise.resolve({ error: null });
        },
        update(patch: Row) {
          return {
            eq(col: string, val: unknown) {
              const f = { ...filters, [col]: val };
              for (const r of rows) if (matches(f)(r)) Object.assign(r, patch);
              return Promise.resolve({ error: null });
            },
          };
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          const res = rows.filter(matches(filters)).map((r) => ({ ...r }));
          return Promise.resolve({ data: res, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return sb;
}

vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => makeFakeSb([], 's1') }));

// eslint-disable-next-line import/first
import { buildToolExecutor } from './tools';
// eslint-disable-next-line import/first
import type { ToolContext } from './types';

const ctx: ToolContext = { userId: 'u1', projectId: 'p1', sessionId: 's1' };

beforeEach(() => {
  storage.getFile.mockReset().mockResolvedValue(null);
  storage.uploadFile.mockReset().mockResolvedValue('ok');
  storage.headBytes.mockReset().mockResolvedValue(0);
});

describe('agent tools — A3', () => {
  it('list_files returns session paths and excludes .trash', async () => {
    const sb = makeFakeSb(
      [{ path: 'index.html', content: 'a' }, { path: '.trash/old.html', content: 'x' }, { path: 'app.js', content: 'b' }],
      's1',
    );
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'list_files', args: {} }, ctx);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual(['app.js', 'index.html']); // sorted, .trash excluded
  });

  it('read_file returns content for an existing file', async () => {
    const sb = makeFakeSb([{ path: 'index.html', content: '<h1>Hi</h1>' }], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'read_file', args: { path: 'index.html' } }, ctx);
    expect(r).toMatchObject({ ok: true, summary: 'index.html', data: '<h1>Hi</h1>' });
  });

  it('read_file returns an honest not-found error', async () => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'read_file', args: { path: 'nope.html' } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('not_found');
  });

  it('read_file over the U1 cap is an honest "zu gross" error, not a truncation', async () => {
    const big = 'x'.repeat(48_001);
    const sb = makeFakeSb([{ path: 'big.txt', content: big }], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'read_file', args: { path: 'big.txt' } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('too_large');
    expect(r.summary).toContain('zu gross');
  });

  it('write_file classifies a brand-new file as NEU and lands a draft', async () => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'index.html', content: '<h1>Neu</h1>' } }, ctx);
    expect(r.ok).toBe(true);
    expect(r.summary).toBe('index.html · NEU');
    expect(r.file).toMatchObject({ path: 'index.html', classification: 'NEU' });
    const row = sb.rows().find((x) => x.path === 'index.html');
    expect(row?.change_state).toBe('draft');
  });

  it('write_file classifies an edit as GEÄNDERT with a real +n −m delta', async () => {
    const sb = makeFakeSb([{ path: 'a.txt', content: 'line1\nline2\nline3\n' }], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'a.txt', content: 'line1\nCHANGED\nline3\nline4\n' } }, ctx);
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/^a\.txt · GEÄNDERT \+\d+ −\d+$/);
    expect(r.file?.classification).toBe('GEÄNDERT');
    expect(r.file?.added).toBeGreaterThan(0);
  });

  it('write_file classifies an unchanged rewrite as IDENTISCH (newline noise ignored)', async () => {
    const sb = makeFakeSb([{ path: 'a.txt', content: 'hello\n' }], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'a.txt', content: 'hello' } }, ctx);
    expect(r.summary).toBe('a.txt · IDENTISCH');
    expect(r.file?.classification).toBe('IDENTISCH');
  });

  // F-17: a guessed css/js sibling must be retargeted to the asset the entry HTML
  // links, so the attested path IS the written path IS the shipped/served asset.
  it('write_file retargets a guessed css sibling to the linked asset (attested == shipped)', async () => {
    const sb = makeFakeSb(
      [
        { path: 'index.html', content: '<!doctype html><link rel="stylesheet" href="style.css"><h1>Hi</h1>' },
        { path: 'style.css', content: 'body{color:red}' },
      ],
      's1',
    );
    const exec = buildToolExecutor(sb as never);
    // The model guesses `styles.css` (the parse-code-blocks default) — a sibling the
    // entry never links.
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'styles.css', content: 'body{color:blue}' } }, ctx);
    expect(r.ok).toBe(true);
    // Attested path is the LINKED file, not the guessed sibling.
    expect(r.file?.path).toBe('style.css');
    // And it is classified as a real edit of THAT file (red -> blue), not NEU of a sibling.
    expect(r.file?.classification).toBe('GEÄNDERT');
    // The draft landed on the linked file; no orphan sibling was created.
    expect(sb.rows().some((x) => x.path === 'styles.css')).toBe(false);
    expect(sb.rows().find((x) => x.path === 'style.css')?.content).toBe('body{color:blue}');
  });

  it('write_file leaves an already-linked css path untouched, and does not reconcile when ambiguous', async () => {
    // (a) exact linked path — no retarget.
    const sb = makeFakeSb(
      [{ path: 'index.html', content: '<link rel="stylesheet" href="style.css">' }, { path: 'style.css', content: 'a{}' }],
      's1',
    );
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'style.css', content: 'a{color:green}' } }, ctx);
    expect(r.file?.path).toBe('style.css');

    // (b) two linked stylesheets → ambiguous → the guessed path is left as-is (NEU),
    // never silently merged onto one of them.
    const sb2 = makeFakeSb(
      [{ path: 'index.html', content: '<link rel="stylesheet" href="a.css"><link rel="stylesheet" href="b.css">' }],
      's1',
    );
    const exec2 = buildToolExecutor(sb2 as never);
    const r2 = await exec2({ id: 'c2', name: 'write_file', args: { path: 'c.css', content: 'x{}' } }, ctx);
    expect(r2.file?.path).toBe('c.css');
    expect(r2.file?.classification).toBe('NEU');
  });

  it('save_draft promotes drafts to storage and is idempotent', async () => {
    const sb = makeFakeSb([{ path: 'index.html', content: 'a', change_state: 'draft' }], 's1');
    const exec = buildToolExecutor(sb as never);
    const r1 = await exec({ id: 'c1', name: 'save_draft', args: {} }, ctx);
    expect(r1.ok).toBe(true);
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    expect(sb.rows().find((x) => x.path === 'index.html')?.change_state).toBe('saved');
    // second call: nothing left to save → still ok (idempotent), no new upload.
    const r2 = await exec({ id: 'c2', name: 'save_draft', args: {} }, ctx);
    expect(r2.ok).toBe(true);
    expect((r2.data as { saved: number }).saved).toBe(0);
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('finish is a terminator; unknown tools return a structured error', async () => {
    const exec = buildToolExecutor(makeFakeSb([], 's1') as never);
    const fin = await exec({ id: 'c1', name: 'finish', args: { report: 'done' } }, ctx);
    expect(fin).toMatchObject({ ok: true, terminate: true, report: 'done' });
    const unk = await exec({ id: 'c2', name: 'deploy', args: {} }, ctx);
    expect(unk.ok).toBe(false);
    expect(unk.error?.code).toBe('unknown_tool');
  });
});
