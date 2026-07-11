// WAVE-D · D-1 gate — adversarial tests driving the REAL tool executor. Proves that a
// malicious run cannot escape its project via read_file/write_file: traversal, absolute,
// encoded-separator, and null-byte paths are denied with an honest error and NEVER land
// a draft row; secret/control files (.env, .git/*) are refused; oversize is refused;
// and a legitimate messy path is canonicalized before it is stored.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const storage = {
  getFile: vi.fn(async (): Promise<string | null> => null),
  uploadFile: vi.fn(async () => 'ok'),
  headBytes: vi.fn(async () => 0),
};
vi.mock('../file-storage', () => ({
  getFile: (...a: unknown[]) => (storage.getFile as (...x: unknown[]) => unknown)(...a),
  uploadFile: (...a: unknown[]) => (storage.uploadFile as (...x: unknown[]) => unknown)(...a),
  headBytes: (...a: unknown[]) => (storage.headBytes as (...x: unknown[]) => unknown)(...a),
  listFiles: vi.fn(async () => [] as string[]),
  downloadFile: vi.fn(async () => ''),
}));
vi.mock('../storage-usage', () => ({
  byteLen: (s: string) => Buffer.byteLength(s, 'utf8'),
  assertStorageRoom: vi.fn(async () => {}),
}));

type Row = Record<string, unknown>;
function matches(filters: Row) {
  return (r: Row) => Object.entries(filters).every(([k, v]) => r[k] === v);
}
function makeFakeSb(initial: Array<{ path: string; content: string; change_state?: string }>, sessionId: string) {
  let seq = 0;
  const rows: Row[] = initial.map((f) => ({
    id: `f${seq++}`, session_id: sessionId, user_id: 'u1', path: f.path, content: f.content,
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

describe('D-1 · write_file path traversal is denied and lands NO draft', () => {
  it.each([
    '../escape.html',
    '../../etc/passwd',
    'css/../../other-project/index.html',
    '/etc/passwd',
    '~/secrets',
    'C:/Windows/x',
    '..%2f..%2fsecret',
    'css%2fapp.css',
    'a\\b.html',
  ])('denies %j', async (badPath) => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: badPath, content: 'x' } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('invalid_path');
    // Critical: the draft store is untouched — no escape artifact persisted.
    expect(sb.rows().length).toBe(0);
  });

  it('denies an embedded NUL byte', async () => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'ok.html\x00.png', content: 'x' } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('invalid_path');
    expect(sb.rows().length).toBe(0);
  });
});

describe('D-1 · read_file path traversal is denied', () => {
  it.each(['../secret.html', '/etc/passwd', '..%2fsecret', 'a\\b'])('denies %j', async (badPath) => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'read_file', args: { path: badPath } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('invalid_path');
    // The storage layer must never even be consulted for an unsafe path.
    expect(storage.getFile).not.toHaveBeenCalled();
  });
});

describe('D-1 · forbidden secret/control files are refused', () => {
  it.each(['.env', '.env.production', 'nested/.git/config', '.ssh/id_rsa', '.npmrc'])(
    'refuses to write %j',
    async (badPath) => {
      const sb = makeFakeSb([], 's1');
      const exec = buildToolExecutor(sb as never);
      const r = await exec({ id: 'c1', name: 'write_file', args: { path: badPath, content: 'SECRET=1' } }, ctx);
      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('forbidden_file');
      expect(sb.rows().length).toBe(0);
    },
  );
});

describe('D-1 · oversize write is refused', () => {
  it('rejects content over the 500k cap', async () => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const huge = 'x'.repeat(500_001);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: 'big.html', content: huge } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('too_large');
    expect(sb.rows().length).toBe(0);
  });
});

describe('D-1 · a legitimate messy path is canonicalized before storage', () => {
  it('stores ./css//app.css as css/app.css', async () => {
    const sb = makeFakeSb([], 's1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'write_file', args: { path: './css//app.css', content: 'body{}' } }, ctx);
    expect(r.ok).toBe(true);
    const stored = sb.rows().find((x) => x.content === 'body{}');
    expect(stored?.path).toBe('css/app.css');
  });
});
