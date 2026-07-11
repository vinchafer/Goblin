// WAVE-D · D-1 gate — the storage choke-point itself. These run against the REAL
// file-storage module in its in-memory mode (no STORAGE_* env → memory fallback), so
// they prove storageKey() rejects an unsafe path no matter which caller reaches it
// (agent tools, the file-explorer upload route, templates, the generator), and that a
// legitimate write lands under — and only under — the project's own prefix.

import { describe, it, expect, beforeAll } from 'vitest';

// Force the in-memory backend: clear any storage credentials before the module loads.
beforeAll(() => {
  delete process.env.STORAGE_ENDPOINT;
  delete process.env.STORAGE_KEY;
  delete process.env.STORAGE_SECRET;
  delete process.env.STORAGE_BUCKET;
});

// eslint-disable-next-line import/first
import { uploadFile, getFile, deleteFile, headBytes } from './file-storage';

const UNSAFE = ['../escape', '../../other-project/index.html', '/etc/passwd', 'a\\b', '..%2fx', 'x\x00y'];

describe('D-1 · storageKey rejects unsafe paths at the choke-point (write)', () => {
  it.each(UNSAFE)('uploadFile throws unsafe_path for %j', async (bad) => {
    await expect(uploadFile('proj-1', bad, 'data')).rejects.toMatchObject({ code: 'unsafe_path' });
  });
});

describe('D-1 · storageKey rejects unsafe paths at the choke-point (read/delete/head)', () => {
  it.each(UNSAFE)('getFile throws unsafe_path for %j', async (bad) => {
    await expect(getFile('proj-1', bad)).rejects.toMatchObject({ code: 'unsafe_path' });
  });
  it('deleteFile throws unsafe_path for a traversal path', async () => {
    await expect(deleteFile('proj-1', '../../x')).rejects.toMatchObject({ code: 'unsafe_path' });
  });
  it('headBytes throws unsafe_path for a traversal path', async () => {
    await expect(headBytes('proj-1', '../../x')).rejects.toMatchObject({ code: 'unsafe_path' });
  });
});

describe('D-1 · a project cannot reach another project via a traversal key', () => {
  it('writing project A never lands under project B, even with a ../B/ key attempt', async () => {
    await uploadFile('projB', 'index.html', 'SECRET-B');
    // Project A attempts to escape into projB via traversal — must be denied outright.
    await expect(uploadFile('projA', '../projB/index.html', 'HACKED')).rejects.toMatchObject({
      code: 'unsafe_path',
    });
    // projB's file is untouched.
    expect(await getFile('projB', 'index.html')).toBe('SECRET-B');
  });
});

describe('D-1 · legitimate paths still work and canonicalize', () => {
  it('round-trips a normal file', async () => {
    await uploadFile('proj-2', 'css/app.css', 'body{}');
    expect(await getFile('proj-2', 'css/app.css')).toBe('body{}');
  });
  it('canonicalizes ./ and // so read and write agree on the key', async () => {
    await uploadFile('proj-3', './a//b.js', 'X');
    expect(await getFile('proj-3', 'a/b.js')).toBe('X');
  });
});
