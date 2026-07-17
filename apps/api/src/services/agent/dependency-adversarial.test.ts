// WAVE-E E3 — ADVERSARIAL: the agent is asked (tricked) into adding a malicious /
// typosquatted package. The write pipeline (write_file AND edit_file) must BLOCK the
// package.json before it lands as a draft — the malicious manifest never reaches the
// user's Vercel build. Coordinates with Wave-D (which sandboxes tool execution) without
// duplicating it: this gate is about what package.json the agent may AUTHOR.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../file-storage', () => ({
  getFile: vi.fn(async () => null),
  uploadFile: vi.fn(async () => 'ok'),
  headBytes: vi.fn(async () => 0),
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
function makeFakeSb(sessionId: string, initial: Array<{ path: string; content: string; change_state?: string }> = []) {
  let seq = 0;
  const rows: Row[] = initial.map((f) => ({
    id: `f${seq++}`, session_id: sessionId, user_id: 'u1', path: f.path, content: f.content, change_state: f.change_state ?? 'saved',
  }));
  return {
    rows: () => rows,
    from(_t: string) {
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
          return { eq(col: string, val: unknown) {
            const f = { ...filters, [col]: val };
            for (const r of rows) if (matches(f)(r)) Object.assign(r, patch);
            return Promise.resolve({ error: null });
          } };
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          const res = rows.filter(matches(filters)).map((r) => ({ ...r }));
          return Promise.resolve({ data: res, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => makeFakeSb('s1') }));

// eslint-disable-next-line import/first
import { buildToolExecutor } from './tools';
// eslint-disable-next-line import/first
import type { ToolContext } from './types';

const ctx: ToolContext = { userId: 'u1', projectId: 'p1', sessionId: 's1' };

const MALICIOUS = JSON.stringify({
  name: 'app',
  dependencies: { react: '18.3.1', 'totally-safe-analytics': '9.9.9' },
}, null, 2);

describe('E3 adversarial — malicious package via write_file', () => {
  it('BLOCKS a package.json with a non-allowlisted dependency; nothing is persisted', async () => {
    const sb = makeFakeSb('s1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec(
      { id: 'c1', name: 'write_file', args: { path: 'package.json', content: MALICIOUS } },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('dependency_rejected');
    expect(r.error?.message).toContain('totally-safe-analytics');
    expect(r.error?.message).toContain('[EN]'); // honest DE+EN edge
    // the malicious manifest never became a draft
    expect(sb.rows().find((x) => x.path === 'package.json')).toBeUndefined();
  });

  it('BLOCKS the same attack routed through edit_file', async () => {
    const clean = JSON.stringify({ name: 'app', dependencies: { react: '18.3.1' } }, null, 2);
    const sb = makeFakeSb('s1', [{ path: 'package.json', content: clean }]);
    const exec = buildToolExecutor(sb as never);
    // edit the clean manifest to inject a typosquat
    const r = await exec(
      {
        id: 'c1',
        name: 'edit_file',
        args: {
          path: 'package.json',
          old_str: '"react": "18.3.1"',
          new_str: '"react": "18.3.1", "reactt-dom": "1.0.0"',
        },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('dependency_rejected');
    expect(r.error?.message).toContain('reactt-dom');
    // the stored manifest is unchanged (still the clean one)
    const row = sb.rows().find((x) => x.path === 'package.json');
    expect(row?.content).toBe(clean);
  });

  it('ALLOWS a clean, allowlisted, pinned package.json (no false positive)', async () => {
    const clean = JSON.stringify({
      name: 'app',
      dependencies: { react: '18.3.1', 'react-dom': '18.3.1' },
      devDependencies: { vite: '5.4.11' },
    }, null, 2);
    const sb = makeFakeSb('s1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec(
      { id: 'c1', name: 'write_file', args: { path: 'package.json', content: clean } },
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(sb.rows().find((x) => x.path === 'package.json')?.change_state).toBe('draft');
  });
});
