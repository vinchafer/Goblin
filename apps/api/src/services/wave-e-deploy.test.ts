// WAVE-E E3 — the deploy-from-source config: framework detection (static path stays
// null → byte-identical) and the truth-gate's builtOutput mode (skip source byte-compare
// for a Vercel-built site, still verify reachability + built assets).

import { describe, it, expect, vi } from 'vitest';
import { detectVercelFramework } from './framework-templates';

describe('detectVercelFramework — the deploy-path gate', () => {
  it('returns null when there is no package.json (STATIC path → framework:null, unchanged)', () => {
    expect(detectVercelFramework(null)).toBeNull();
    expect(detectVercelFramework(undefined)).toBeNull();
    expect(detectVercelFramework('')).toBeNull();
  });

  it('detects vite from a React/Vite package.json', () => {
    const pkg = JSON.stringify({ dependencies: { react: '18.3.1' }, devDependencies: { vite: '5.4.11' } });
    expect(detectVercelFramework(pkg)).toBe('vite');
  });

  it('returns null for a package.json without a recognized framework (safe fallback)', () => {
    const pkg = JSON.stringify({ dependencies: { express: '4.0.0' } });
    expect(detectVercelFramework(pkg)).toBeNull();
  });

  it('returns null on malformed JSON (never throws — falls back to static behavior)', () => {
    expect(detectVercelFramework('{ broken')).toBeNull();
  });
});

// ── verifyDeployment builtOutput mode ──
vi.mock('./file-storage', () => ({
  downloadFile: vi.fn(async () => '<!doctype html><html>SOURCE index.html with /src/main.tsx</html>'),
}));

// eslint-disable-next-line import/first
import { verifyDeployment } from './deploy-verification';

describe('verifyDeployment — builtOutput skips the source byte-compare', () => {
  const BUILT_HTML = '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script></body></html>';

  it('a Vite-built site (served ≠ source) VERIFIES in builtOutput mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      // entry + the built asset both answer 200
      if (url.endsWith('/assets/index-abc123.js')) return new Response('/* bundle */', { status: 200 });
      return new Response(BUILT_HTML, { status: 200 });
    });
    const verdict = await verifyDeployment('https://app.vercel.app', 'p1', ['package.json', 'index.html', 'src/main.tsx'], undefined, {
      builtOutput: true,
      attempts: 1,
      retryDelayMs: 0,
    });
    expect(verdict.ok).toBe(true);
    fetchMock.mockRestore();
  });

  it('WITHOUT builtOutput the same served-≠-source page fails the byte-compare (proves the mode matters)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(BUILT_HTML, { status: 200 }));
    const verdict = await verifyDeployment('https://app.vercel.app', 'p1', ['index.html'], undefined, {
      builtOutput: false,
      attempts: 1,
      retryDelayMs: 0,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('entspricht noch nicht');
    fetchMock.mockRestore();
  });

  it('builtOutput still fails honestly when the entry serves no real HTML (build not ready)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 200 }));
    const verdict = await verifyDeployment('https://app.vercel.app', 'p1', ['package.json', 'index.html'], undefined, {
      builtOutput: true,
      attempts: 1,
      retryDelayMs: 0,
    });
    expect(verdict.ok).toBe(false);
    fetchMock.mockRestore();
  });
});
