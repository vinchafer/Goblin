/**
 * AKT 2 · PHASE 2 · U2.4 — the truth gate.
 *
 * The property under test is narrow and load-bearing: a URL that answers 200 is
 * NOT the same as a URL that serves what we uploaded. A half-uploaded app, a stale
 * cached object and a mangled content type all answer 200 perfectly happily.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const verifyDeployment = vi.fn();
vi.mock('./deploy-verification', () => ({ verifyDeployment: (...a: unknown[]) => verifyDeployment(...a) }));

const { verifyHostedPublish, pickAssetsToCheck } = await import('./ops-hosted-verify');

const fetchMock = vi.fn();

const file = (path: string, content: string) => ({ path, bytes: Buffer.from(content, 'utf8') });
const served = (content: string) => ({ ok: true, arrayBuffer: async () => Buffer.from(content, 'utf8') });

beforeEach(() => {
  verifyDeployment.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  verifyDeployment.mockResolvedValue({ ok: true, failedAssets: [] });
});
afterEach(() => vi.unstubAllGlobals());

describe('asset selection', () => {
  it('checks the biggest assets first — a truncated upload shows there, not in a favicon', () => {
    const picked = pickAssetsToCheck(
      [file('index.html', 'x'), file('small.css', 'ab'), file('big.js', 'a'.repeat(500)), file('mid.css', 'a'.repeat(50))],
      2,
    );
    expect(picked.map((f) => f.path)).toEqual(['big.js', 'mid.css']);
  });

  it('never spends a check on the entry document — the reused gate already did', () => {
    expect(pickAssetsToCheck([file('index.html', 'a'.repeat(999))]).map((f) => f.path)).toEqual([]);
  });
});

describe('verifyHostedPublish', () => {
  it('reuses the P0.2 verifier and reports its refusal verbatim', async () => {
    verifyDeployment.mockResolvedValue({ ok: false, reason: 'Die veröffentlichte Seite antwortet nicht (HTTP 502).', failedAssets: [] });
    const r = await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [file('index.html', 'x')]);
    expect(r.ok).toBe(false);
    expect(r.entryOk).toBe(false);
    expect(r.reason).toContain('antwortet nicht');
    expect(fetchMock).not.toHaveBeenCalled(); // no point byte-checking a dead site
  });

  it('passes when every checked asset comes back byte-identical', async () => {
    fetchMock.mockResolvedValue(served('console.log(1)'));
    const r = await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [
      file('index.html', '<h1>a</h1>'),
      file('app.js', 'console.log(1)'),
    ]);
    expect(r).toMatchObject({ ok: true, entryOk: true, assetsChecked: 1, assetsMatched: 1, mismatched: [] });
  });

  it('FAILS a 200 that serves the wrong bytes', async () => {
    // The whole reason this exists: reachable is not the same as correct.
    fetchMock.mockResolvedValue(served('console.log(2) /* der alte Stand */'));
    const r = await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [
      file('index.html', '<h1>a</h1>'),
      file('app.js', 'console.log(1)'),
    ]);
    expect(r.ok).toBe(false);
    expect(r.mismatched).toEqual(['app.js']);
    expect(r.reason).toContain('nicht den hochgeladenen Stand');
  });

  it('counts an unreachable asset as a mismatch, not as a pass', async () => {
    fetchMock.mockResolvedValue({ ok: false, arrayBuffer: async () => Buffer.alloc(0) });
    const r = await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [
      file('index.html', '<h1>a</h1>'),
      file('app.js', 'console.log(1)'),
    ]);
    expect(r.ok).toBe(false);
    expect(r.assetsMatched).toBe(0);
  });

  it('counts a network failure as a mismatch rather than throwing', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const r = await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [
      file('index.html', '<h1>a</h1>'),
      file('app.js', 'x'),
    ]);
    expect(r.ok).toBe(false);
  });

  it('builds asset URLs against the app`s own host, trailing slash or not', async () => {
    fetchMock.mockResolvedValue(served('x'));
    await verifyHostedPublish('https://meinladen.justgoblin.app/', 'proj-1', [file('index.html', 'a'), file('assets/app.js', 'x')]);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://meinladen.justgoblin.app/assets/app.js');
  });

  it('passes an entry-only app without inventing assets to check', async () => {
    const r = await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [file('index.html', '<h1>a</h1>')]);
    expect(r).toMatchObject({ ok: true, assetsChecked: 0, assetsMatched: 0 });
  });

  it('waits far less than the Vercel path — there is no build to wait for', async () => {
    await verifyHostedPublish('https://meinladen.justgoblin.app', 'proj-1', [file('index.html', 'a')]);
    const opts = verifyDeployment.mock.calls[0]![4] as { attempts: number; retryDelayMs: number };
    expect(opts.attempts).toBe(5);
    expect(opts.retryDelayMs).toBe(4_000);
  });
});
