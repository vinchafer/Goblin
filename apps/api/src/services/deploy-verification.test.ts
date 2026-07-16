/**
 * DD-hardening FW6-U4 — truth-test the deploy TRUTH GATE.
 *
 * verifyDeployment is what gates the "Veröffentlicht / Live ✓" claim: it may say
 * ok only when the deployed URL actually serves the artifact we stored AND every
 * referenced asset answers 200. That gate had no test of its own — so this proves
 * it BOTH ways:
 *   - serve the WRONG content  → verification FAILS (honest German reason),
 *   - serve the RIGHT content  → verification passes (Live ✓),
 *   - a referenced asset 404s  → FAILS, naming the asset,
 *   - the entry URL is down     → FAILS.
 * A gate that only ever returns ok is not a gate; this makes sure it can say no.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The stored artifact the deploy is verified against.
const STORED_HTML = [
  '<!doctype html><html><head>',
  '<link rel="stylesheet" href="styles.css">',
  '</head><body><h1>Mein Goblin</h1>',
  '<script src="app.js"></script>',
  '</body></html>',
].join('');

vi.mock('./file-storage', () => ({
  downloadFile: async (_projectId: string, path: string) =>
    path === 'index.html' ? STORED_HTML : '',
}));

import { verifyDeployment } from './deploy-verification';

const BASE = 'https://mein-goblin.vercel.app';
const FILES = ['index.html', 'styles.css', 'app.js'];
const FAST = { attempts: 2, retryDelayMs: 0 };

// Per-test routing table: URL → { status, body }. Anything unlisted → 404.
let routes: Record<string, { status: number; body?: string }>;

function res(status: number, body?: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body ?? '' };
}

beforeEach(() => {
  routes = {};
  vi.stubGlobal('fetch', async (url: string | URL) => {
    const key = String(url);
    const r = routes[key];
    return res(r?.status ?? 404, r?.body);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('verifyDeployment — the deploy truth gate (FW6-U4)', () => {
  it('RIGHT content + all assets 200 → Live ✓ (ok:true)', async () => {
    routes = {
      [BASE]: { status: 200, body: STORED_HTML },
      [`${BASE}/styles.css`]: { status: 200, body: 'body{}' },
      [`${BASE}/app.js`]: { status: 200, body: 'console.log(1)' },
    };
    const v = await verifyDeployment(BASE, 'proj-1', FILES, undefined, FAST);
    expect(v.ok).toBe(true);
    expect(v.failedAssets).toEqual([]);
  });

  it('WRONG content served → verification FAILS (does not falsely claim Live)', async () => {
    routes = {
      [BASE]: { status: 200, body: '<html><body>someone else\'s site</body></html>' },
      [`${BASE}/styles.css`]: { status: 200, body: 'body{}' },
      [`${BASE}/app.js`]: { status: 200, body: 'x' },
    };
    const v = await verifyDeployment(BASE, 'proj-1', FILES, undefined, FAST);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('entspricht noch nicht dem gespeicherten Stand');
  });

  it('a referenced asset 404s → FAILS and names the asset', async () => {
    routes = {
      [BASE]: { status: 200, body: STORED_HTML },
      [`${BASE}/styles.css`]: { status: 200, body: 'body{}' },
      // app.js intentionally missing → 404
    };
    const v = await verifyDeployment(BASE, 'proj-1', FILES, undefined, FAST);
    expect(v.ok).toBe(false);
    expect(v.failedAssets).toContain('app.js');
    expect(v.reason).toContain('app.js');
  });

  it('the entry URL is unreachable → FAILS (never claims Live on a dead site)', async () => {
    routes = { [BASE]: { status: 500 } };
    const v = await verifyDeployment(BASE, 'proj-1', FILES, undefined, FAST);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('antwortet nicht');
  });
});
