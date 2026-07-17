/**
 * Wave C · C-3 backend — Papierkorb lifecycle through the REAL routes.
 *
 * No S3 in the test env → file-storage uses its in-memory fallback, so the real
 * soft-delete → .trash write, the reversible trash-path scheme, list-trash, restore
 * (net-zero) and batched purge all run for real; only Supabase (ownership) + auth are
 * mocked. Covers: soft-delete lands in trash with a recoverable original path; the
 * Papierkorb lists it; restore returns it to the exact original path and clears the
 * trash entry; restore refuses to clobber a live file (409); purge empties the trash;
 * legacy flattened entries are listed but not auto-restorable (honest 400).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeBuilder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.single = () => Promise.resolve({ data: { id: 'proj-1' }, error: null });
  b.maybeSingle = () => Promise.resolve({ data: { id: 'proj-1' }, error: null });
  b.insert = () => Promise.resolve({ data: null, error: null });
  b.delete = () => b;
  return b;
}
vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: () => makeBuilder() }) }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1'); await next();
  },
}));

import { projects } from './projects';
import { uploadFile, listFiles } from '../services/file-storage';

const P = 'proj-1';
const create = (path: string, content: string) =>
  projects.request(`/${P}/files`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, content }) });
const softDelete = (path: string) => projects.request(`/${P}/files/${path}`, { method: 'DELETE' });
const listTrash = () => projects.request(`/${P}/trash`);
const restore = (trashPath: string) =>
  projects.request(`/${P}/files/restore`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashPath }) });
const purge = () => projects.request(`/${P}/files/purge-trash`, { method: 'POST' });

beforeEach(async () => {
  delete process.env.STORAGE_ENDPOINT;
  // Clean slate: purge any residue from a prior test in the shared in-memory map.
  for (const f of await listFiles(P)) {
    await projects.request(`/${P}/files/${f}`, { method: 'DELETE' });
  }
  await purge();
});

describe('Papierkorb lifecycle (C-3 backend)', () => {
  it('soft-delete → list → restore round-trip returns the file to its exact original path', async () => {
    await create('docs/note.md', '# Hallo Ümlaut');
    expect(await listFiles(P)).toContain('docs/note.md');

    const del = await softDelete('docs/note.md');
    expect(del.status).toBe(200);
    const trashedAs = (await del.json()).trashedAs as string;
    expect(trashedAs.startsWith('.trash/')).toBe(true);
    // original gone from the live tree
    expect(await listFiles(P)).not.toContain('docs/note.md');

    // Papierkorb lists it with the recovered original path (new reversible scheme)
    const tr = await listTrash();
    expect(tr.status).toBe(200);
    const entries = (await tr.json()).entries as Array<{ trashPath: string; originalPath: string | null; legacy: boolean }>;
    expect(entries.length).toBe(1);
    expect(entries[0]!.originalPath).toBe('docs/note.md');
    expect(entries[0]!.legacy).toBe(false);
    expect(entries[0]!.trashPath).toBe(trashedAs);

    // Restore → exact original path, content intact, trash cleared
    const rr = await restore(trashedAs);
    expect(rr.status).toBe(200);
    expect((await rr.json()).restoredTo).toBe('docs/note.md');

    const live = await listFiles(P);
    expect(live).toContain('docs/note.md');
    expect(live.some((f) => f.startsWith('.trash/'))).toBe(false);
    const got = await projects.request(`/${P}/files/docs/note.md`);
    expect((await got.json()).content).toBe('# Hallo Ümlaut');
  });

  it('restore refuses to clobber a live file that reclaimed the path (409 conflict)', async () => {
    await create('a.txt', 'first');
    const del = await softDelete('a.txt');
    const trashedAs = (await del.json()).trashedAs as string;
    await create('a.txt', 'second (recreated)'); // path reclaimed

    const rr = await restore(trashedAs);
    expect(rr.status).toBe(409);
    const body = await rr.json();
    expect(body.conflict).toBe(true);
    // The live file is untouched; the trash entry still exists (not consumed).
    const got = await projects.request(`/${P}/files/a.txt`);
    expect((await got.json()).content).toBe('second (recreated)');
    const entries = (await (await listTrash()).json()).entries as unknown[];
    expect(entries.length).toBe(1);
  });

  it('purge-trash empties the Papierkorb (batched)', async () => {
    await create('x.txt', 'x');
    await create('y.txt', 'y');
    await softDelete('x.txt');
    await softDelete('y.txt');
    expect(((await (await listTrash()).json()).entries as unknown[]).length).toBe(2);

    const pr = await purge();
    expect(pr.status).toBe(200);
    expect((await pr.json()).purged).toBe(2);
    expect(((await (await listTrash()).json()).entries as unknown[]).length).toBe(0);
  });

  it('legacy flattened trash entries are listed but not auto-restorable (honest 400)', async () => {
    // Seed an entry in the OLD lossy scheme (pre-Wave-C): .trash/<ts>_<flat>
    const legacyKey = `.trash/1700000000000_docs_old.md`;
    await uploadFile(P, legacyKey, 'legacy content', { enforce: false });

    const entries = (await (await listTrash()).json()).entries as Array<{ trashPath: string; originalPath: string | null; legacy: boolean }>;
    const legacy = entries.find((e) => e.trashPath === legacyKey);
    expect(legacy).toBeTruthy();
    expect(legacy!.legacy).toBe(true);
    expect(legacy!.originalPath).toBeNull();

    const rr = await restore(legacyKey);
    expect(rr.status).toBe(400);
    expect((await rr.json()).error).toBe('legacy_unrestorable');
  });
});
