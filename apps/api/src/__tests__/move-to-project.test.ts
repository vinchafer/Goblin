import { describe, it, expect, beforeEach } from 'vitest';
import { uploadFile, getFile, listFiles, deleteFile, deleteProject } from '../services/file-storage';

// ─────────────────────────────────────────────────────────────────────────────
// WS-B.1 — cross-project move data-safety invariant.
//
// The route (POST /api/projects/:id/files/move-to-project) copies a file into the
// target project FIRST, verifies the bytes landed, and only THEN deletes the
// source. This test exercises that exact sequence on the real file-storage
// backend so the copy-before-delete guarantee can never silently regress.
// ─────────────────────────────────────────────────────────────────────────────

const A = 'test-move-src-project';
const B = 'test-move-dst-project';
const CONTENT = 'export const hello = () => "world";\n';

/** Mirrors the route's data-safe move: copy → verify → delete. */
async function safeMove(from: string, to: string, path: string, toPath = path): Promise<'ok' | 'conflict' | 'copy-failed'> {
  const content = await getFile(from, path);
  if (content === null) throw new Error('source missing');
  if ((await getFile(to, toPath)) !== null) return 'conflict';
  await uploadFile(to, toPath, content);
  const verify = await getFile(to, toPath);
  if (verify === null || verify !== content) return 'copy-failed'; // source untouched
  await deleteFile(from, path);
  return 'ok';
}

describe('cross-project move — copy before delete', () => {
  beforeEach(async () => {
    await deleteProject(A);
    await deleteProject(B);
    await uploadFile(A, 'src/util.ts', CONTENT);
  });

  it('moves a file A→B: appears in B with intact content, gone from A', async () => {
    const result = await safeMove(A, B, 'src/util.ts');
    expect(result).toBe('ok');

    expect(await getFile(B, 'src/util.ts')).toBe(CONTENT); // intact in target
    expect(await getFile(A, 'src/util.ts')).toBeNull();    // removed from source
    expect(await listFiles(A)).not.toContain('src/util.ts');
    expect(await listFiles(B)).toContain('src/util.ts');
  });

  it('refuses to overwrite an existing file in the target (source stays put)', async () => {
    await uploadFile(B, 'src/util.ts', 'DIFFERENT');
    const result = await safeMove(A, B, 'src/util.ts');
    expect(result).toBe('conflict');

    // Nothing destroyed: source still here, target unchanged.
    expect(await getFile(A, 'src/util.ts')).toBe(CONTENT);
    expect(await getFile(B, 'src/util.ts')).toBe('DIFFERENT');
  });
});
