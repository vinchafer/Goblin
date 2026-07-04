/**
 * C4b — the project ZIP export must exclude soft-deleted files (.trash/).
 * Uses the in-memory storage fallback (no STORAGE_ENDPOINT configured).
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { uploadFile, createZip } from '../services/file-storage';

const hasRealStorage = !!process.env.STORAGE_ENDPOINT;

describe.skipIf(hasRealStorage)('createZip — .trash exclusion', () => {
  it('includes live files and omits .trash/ entries', async () => {
    const projectId = `zip-test-${Math.floor(Math.random() * 1e9)}`;
    await uploadFile(projectId, 'index.html', '<h1>live</h1>');
    await uploadFile(projectId, 'src/app.js', 'console.log(1)');
    await uploadFile(projectId, '.trash/1700000000_old.html', '<h1>deleted</h1>');

    const buf = await createZip(projectId);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);

    expect(names).toContain('index.html');
    expect(names).toContain('src/app.js');
    expect(names.some((n) => n.startsWith('.trash/'))).toBe(false);
  });
});
