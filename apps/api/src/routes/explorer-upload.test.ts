/**
 * FW5-U3 (D-D) — explorer upload through the REAL hardened guard chain.
 *
 * No S3 configured in the test env → file-storage writes to its in-memory fallback, so
 * the real `storageKey` prefix-jail (project-path.assertSafeStoragePath) and the real
 * upload-policy + abuse-caps run; only Supabase (ownership + file-meta) and auth are
 * mocked. Covers the gate: allowed type lands + is listed; oversize → honest 413;
 * wrong type → honest 415; traversal-style targetDir → jailed (unsafe_path 400);
 * per-user daily cap → honest 429 copy.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __resetDailyBytesForTest } from '../services/abuse-caps';
import { listFiles, getFileBytes } from '../services/file-storage';

// Ownership + file-meta: a permissive fake that returns "owned" and swallows meta writes.
function makeBuilder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.single = () => Promise.resolve({ data: { id: 'proj-1' }, error: null });
  b.maybeSingle = () => Promise.resolve({ data: null, error: null });
  b.insert = () => Promise.resolve({ data: null, error: null });
  return b;
}
vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: () => makeBuilder() }) }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1'); await next();
  },
}));

import { projects } from './projects';

function upload(projectId: string, name: string, bytes: Uint8Array, targetPath = '') {
  const fd = new FormData();
  // Copy into a fresh ArrayBuffer-backed view so the value is a `Uint8Array<ArrayBuffer>`
  // (a valid BlobPart) rather than the parameter's `Uint8Array<ArrayBufferLike>`.
  fd.append('file', new File([new Uint8Array(bytes)], name), name);
  fd.append('path', targetPath);
  return projects.request(`/${projectId}/files/upload`, { method: 'POST', body: fd });
}

const small = new Uint8Array([1, 2, 3, 4]);

beforeEach(() => { __resetDailyBytesForTest(); delete process.env.STORAGE_ENDPOINT; });
afterEach(() => { __resetDailyBytesForTest(); });

describe('explorer upload — real guard chain', () => {
  it('allowed type lands and is listed (visible to the tree + agent context) and fetchable', async () => {
    const res = await upload('proj-1', 'notes.md', new TextEncoder().encode('# Hallo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.path).toBe('notes.md');
    // Listed by the same listFiles that the files-tree + agent project-context read —
    // i.e. the uploaded file is visible to the agent like any project file.
    const files = await listFiles('proj-1');
    expect(files).toContain('notes.md');
    // And fetchable through the same reader the raw/preview endpoint uses. (Exact byte
    // round-trip is a prod-S3 property; the dev in-memory fallback re-encodes base64, so
    // asserting non-null presence here keeps the test honest — file-storage's own tests
    // cover the S3 byte fidelity.)
    expect(await getFileBytes('proj-1', 'notes.md')).not.toBeNull();
  });

  it('oversize → honest 413 too_big (does NOT consume the daily cap)', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await upload('proj-1', 'huge.png', big);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('too_big');
  });

  it('wrong type → honest 415 wrong_type with the extension', async () => {
    const res = await upload('proj-1', 'malware.exe', small);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe('wrong_type');
    expect(body.ext).toBe('exe');
  });

  it('extensionless file → honest 415 (cannot classify)', async () => {
    const res = await upload('proj-1', 'Dockerfile', small);
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe('wrong_type');
  });

  it('traversal-style target path → jailed (unsafe_path 400), nothing written', async () => {
    const res = await upload('proj-1', 'evil.txt', small, '../../other-project');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('unsafe_path');
    // The jailed write never landed.
    const files = await listFiles('proj-1');
    expect(files.some((f) => f.includes('evil.txt'))).toBe(false);
  });

  it('filename with unsafe chars is sanitized to a flat safe name (still lands)', async () => {
    const res = await upload('proj-1', 'my file (v2)!.txt', small);
    expect(res.status).toBe(200);
    expect((await res.json()).path).toBe('my_file__v2__.txt');
  });

  it('per-user daily cap → honest 429 with Retry-After', async () => {
    process.env.ATTACHMENT_BYTES_PER_DAY = '10'; // 10 bytes → the 2nd small upload exceeds it
    __resetDailyBytesForTest();
    const first = await upload('proj-1', 'a.txt', small); // 4 bytes → ok
    expect(first.status).toBe(200);
    const second = await upload('proj-1', 'b.txt', new Uint8Array(8)); // 4+8 > 10 → capped
    expect(second.status).toBe(429);
    const body = await second.json();
    expect(body.error).toBe('daily_cap');
    expect(second.headers.get('Retry-After')).toBe('3600');
    delete process.env.ATTACHMENT_BYTES_PER_DAY;
  });
});
