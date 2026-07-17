// E-5 (DD U5): a DB blip while persisting the preview URL must NEVER report a
// genuinely-live, truth-gate-verified site as an error. This drives the real deploy
// route with a mocked pipeline where the post-verify `projects.update` THROWS, and
// asserts the SSE stream still emits `type:'success'` (never `type:'error'`) and the
// persist failure is logged loudly rather than surfaced to the user.
//
// Scope note: this is a FOCUSED regression for E-5's persist path only — not the broad
// deploy-route coverage tracked separately as DD T-4.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const H = vi.hoisted(() => ({ logErr: vi.fn() }));

// Chainable Supabase stub: the rate-limit count query resolves {count:0}; the project
// lookup `.single()` returns the row; the post-verify `.update().eq()` REJECTS (the blip).
function makeProjectsBuilder() {
  const b: Record<string, unknown> = {};
  let isUpdate = false;
  b.select = () => b;
  b.update = () => { isUpdate = true; return b; };
  b.eq = () => b;
  b.gte = () => b;
  b.single = async () => ({ data: { id: 'p1', name: 'my-app' }, error: null });
  // Thenable: awaiting the builder either rejects (update) or resolves the count query.
  (b as { then: unknown }).then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    (isUpdate
      ? Promise.reject(new Error('db blip on persist'))
      : Promise.resolve({ count: 0 })
    ).then(resolve, reject);
  return b;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: () => makeProjectsBuilder() }),
}));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1'); await next();
  },
}));
vi.mock('../services/vercel-service', () => ({
  deployToVercel: async () => ({ deploymentId: 'dep_1', url: 'https://p1.vercel.app', protection: 'public' }),
  getDeployStatus: async () => ({ state: 'READY', url: 'https://p1.vercel.app' }),
}));
vi.mock('../services/deploy-verification', () => ({
  verifyDeployment: async () => ({ ok: true, failedAssets: [] }),
  pickEntryFile: () => 'index.html',
}));
vi.mock('../services/file-storage', () => ({
  listFiles: async () => ['index.html'],
  downloadFile: async () => null, // → contentSha stays null → K4 signal block skipped
}));
vi.mock('../services/safety/publish-scan', () => ({ runPublishGuard: async () => ({ ok: true }) }));
vi.mock('../lib/platform-events', () => ({ trackEvent: () => {} }));
vi.mock('../services/notification-service', () => ({ sendToUser: async () => {} }));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error: H.logErr } }));

import { deploy } from './deploy';

beforeEach(() => { H.logErr.mockClear(); });

async function drain(res: Response): Promise<string> {
  return await res.text();
}

describe('deploy route — E-5 persist blip', () => {
  it('DB blip on preview_url persist → still emits success, never error, and logs loudly', async () => {
    const res = await deploy.request('/vercel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1' }),
    });
    expect(res.status).toBe(200);
    const stream = await drain(res);
    // The site is verified-live: the user must see success, not a false error.
    expect(stream).toContain('"type":"success"');
    expect(stream).not.toContain('"type":"error"');
    expect(stream).toContain('https://p1.vercel.app');
    // The persist failure is logged loudly (operator-visible), not swallowed.
    expect(H.logErr).toHaveBeenCalledTimes(1);
  });
});
