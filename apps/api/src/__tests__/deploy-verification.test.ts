// P0.2/P0.3 (feel-sprint-1): reference extraction + deploy truth-gating.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractLocalRefs, isLocalRef, normalizeLocalRef } from '@goblin/shared/src/html-refs';
import { pickEntryFile, verifyDeployment } from '../services/deploy-verification';

vi.mock('../services/file-storage', () => ({
  downloadFile: vi.fn(async () => null),
}));

describe('html-refs extraction', () => {
  it('extracts script src and link href', () => {
    const html = `<html><head>
      <link rel="stylesheet" href="styles.css">
      <script src="settings.js"></script>
    </head><body></body></html>`;
    expect(extractLocalRefs(html).sort()).toEqual(['settings.js', 'styles.css']);
  });

  it('ignores external, data:, protocol-relative and fragment refs', () => {
    const html = `
      <script src="https://cdn.example.com/x.js"></script>
      <link href="//fonts.example.com/f.css" rel="stylesheet">
      <img src="data:image/png;base64,AAA">
      <a href="#section">x</a>
      <script src="./app.js"></script>`;
    expect(extractLocalRefs(html)).toEqual(['app.js']);
  });

  it('normalizes leading ./ and / and strips query/hash', () => {
    expect(normalizeLocalRef('./js/app.js?v=2#x')).toBe('js/app.js');
    expect(normalizeLocalRef('/styles.css')).toBe('styles.css');
  });

  it('W10 case: page referencing styles.css + settings.js', () => {
    const html = `<link href="styles.css" rel="stylesheet"><script src="settings.js"></script>`;
    const refs = extractLocalRefs(html);
    expect(refs).toContain('styles.css');
    expect(refs).toContain('settings.js');
  });

  it('isLocalRef rejects mailto and http', () => {
    expect(isLocalRef('mailto:a@b.c')).toBe(false);
    expect(isLocalRef('http://x.y/z.js')).toBe(false);
    expect(isLocalRef('img/logo.png')).toBe(true);
  });
});

describe('pickEntryFile', () => {
  it('prefers index.html, falls back to root-level html', () => {
    expect(pickEntryFile(['a.js', 'index.html'])).toBe('index.html');
    expect(pickEntryFile(['app.html', 'sub/x.html'])).toBe('app.html');
    expect(pickEntryFile(['a.js'])).toBeNull();
  });
});

describe('verifyDeployment', () => {
  const realFetch = global.fetch;
  const FAST = { attempts: 2, retryDelayMs: 1 };
  afterEach(() => { global.fetch = realFetch; });

  function mockFetch(routes: Record<string, { status: number; body?: string }>) {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const hit = Object.entries(routes).find(([k]) => url === k);
      const r = hit?.[1] ?? { status: 404, body: '' };
      return new Response(r.body ?? '', { status: r.status });
    }) as unknown as typeof fetch;
  }

  it('passes when entry serves 200 and all assets answer 200', async () => {
    const html = '<link href="styles.css" rel="stylesheet"><script src="app.js"></script>';
    mockFetch({
      'https://site.test': { status: 200, body: html },
      'https://site.test/styles.css': { status: 200, body: 'css' },
      'https://site.test/app.js': { status: 200, body: 'js' },
    });
    const v = await verifyDeployment('https://site.test', 'p1', ['index.html', 'styles.css', 'app.js'], undefined, FAST);
    expect(v.ok).toBe(true);
  });

  it('fails honestly (German, names the asset) when a referenced asset 404s', async () => {
    const html = '<link href="styles.css" rel="stylesheet">';
    mockFetch({
      'https://site.test': { status: 200, body: html },
      // styles.css → 404 (default)
    });
    const v = await verifyDeployment('https://site.test', 'p1', ['index.html'], undefined, FAST);
    expect(v.ok).toBe(false);
    expect(v.failedAssets).toEqual(['styles.css']);
    expect(v.reason).toContain('styles.css nicht erreichbar');
  });

  it('fails when the entry URL never answers 200', async () => {
    mockFetch({});
    const v = await verifyDeployment('https://site.test', 'p1', ['index.html'], undefined, FAST);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/antwortet nicht/);
  });
});
