// WAVE-E E2 — create_project_structure scaffolds a real framework baseline through the
// SAME attested write pipeline as write_file, and refuses an unsupported framework with
// an honest DE+EN edge (E5).

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
function makeFakeSb(sessionId: string) {
  let seq = 0;
  const rows: Row[] = [];
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

describe('create_project_structure', () => {
  it('scaffolds the react-vite baseline as attested NEU drafts', async () => {
    const sb = makeFakeSb('s1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec(
      { id: 'c1', name: 'create_project_structure', args: { framework: 'react-vite', appName: 'Aufgabenliste' } },
      ctx,
    );
    expect(r.ok).toBe(true);
    const data = r.data as { framework: string; vercelFramework: string; files: Array<{ path: string; classification: string }> };
    expect(data.framework).toBe('react-vite');
    expect(data.vercelFramework).toBe('vite');
    const paths = data.files.map((f) => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('src/App.tsx');
    expect(paths).toContain('vite.config.ts');
    // all scaffold files are NEU on a fresh project
    expect(data.files.every((f) => f.classification === 'NEU')).toBe(true);
    // and they actually landed as drafts in the session store
    const pkgRow = sb.rows().find((x) => x.path === 'package.json');
    expect(pkgRow?.change_state).toBe('draft');
  });

  it('refuses an unsupported framework with an honest DE+EN edge (E5), no partial scaffold', async () => {
    const sb = makeFakeSb('s1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec(
      { id: 'c1', name: 'create_project_structure', args: { framework: 'nextjs' } },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('framework_unsupported');
    expect(r.error?.message).toContain('react-vite'); // names what IS supported
    expect(r.error?.message).toContain('[EN]'); // bilingual honest copy
    // nothing was written
    expect(sb.rows()).toHaveLength(0);
  });

  it('requires a framework argument', async () => {
    const sb = makeFakeSb('s1');
    const exec = buildToolExecutor(sb as never);
    const r = await exec({ id: 'c1', name: 'create_project_structure', args: {} }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('bad_args');
  });
});
