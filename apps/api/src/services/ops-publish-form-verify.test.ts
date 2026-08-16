/**
 * FOUNDER-WALK-6 · U1 (F4) — end-to-end proof that a form-bearing app verifies
 * green, through the REAL wireForms → REAL verifyHostedPublish → REAL
 * verifyDeployment chain (only network + project storage are faked).
 *
 * Before the fix: form-wiring rewrites the entry HTML in memory but never writes
 * the rewrite back to project storage. `verifyDeployment` used to re-read the
 * entry from storage independently — so it always compared the WIRED bytes the
 * router serves against the STALE, unwired bytes still sitting in storage, and
 * publishing (or republishing) ANY app with a form failed verification, always.
 *
 * This test fixes `downloadFile` (project storage) to return the stale, unwired
 * HTML no matter what — reproducing that precondition exactly — and proves the
 * publish still verifies green, because the truth gate now compares against the
 * bytes that were actually uploaded, not a second read of storage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_HTML =
  '<!doctype html><html lang="de"><body><form id="kontakt"><input name="email"></form></body></html>';

// Project storage never sees the wired bytes — form-wiring only ever rewrites the
// in-memory artifact. If verification fell back to this, it would see the WRONG
// (pre-wiring) content and fail, exactly reproducing F4.
vi.mock('./file-storage', () => ({
  downloadFile: vi.fn(async (_projectId: string, path: string) => (path === 'index.html' ? ORIGINAL_HTML : '')),
  // Unused here (the test supplies its own PublishDeps.listFiles/getFileBytes) but
  // required to exist: ops-publish.ts destructures them at module load for
  // defaultPublishDeps.
  listFiles: vi.fn(async () => []),
  getFileBytes: vi.fn(async () => null),
}));

import { publishHostedApp, type PublishDeps } from './ops-publish';
import { wireForms } from './ops-form-wiring';
import { verifyHostedPublish } from './ops-hosted-verify';
import type { OpsApp } from './ops-apps-store';

const ok = <T>(value: T) => ({ ok: true as const, value });

const DOMAIN = 'justgoblin.app';
const NAME = 'meinladen';
const URL = `https://${NAME}.${DOMAIN}`;

function app(overrides: Partial<OpsApp> = {}): OpsApp {
  return {
    appId: 'app-1', userId: 'user-1', projectId: 'proj-1', appName: NAME,
    status: 'active', capsProfile: 'free-static', r2Prefix: 'apps/app-1/', routeKey: `route:${NAME}`,
    workerScriptName: null, d1DatabaseId: null, lastPublishedAt: null, createdAt: '2026-08-15T00:00:00Z',
    ...overrides,
  };
}

const stage1Pass = { verdict: 'pass' as const, ruleIds: [], hits: [], scannedFiles: 1, scannedBytes: 10 };
function passOutcome() {
  return {
    verdict: 'pass' as const, decidedBy: 'none' as const, stage1: stage1Pass,
    stage2: {
      verdict: 'pass' as const, reason: 'clean' as const, categories: [], confidence: 'high' as const,
      tokens: { estimatedInput: 100, input: 700, output: 20 }, sentChars: 400, model: 'deepseek-ai/DeepSeek-V3.2', tookMs: 5,
    },
    categories: [], ruleIds: [], scannedFiles: 1, scannedBytes: 10,
  };
}

describe('publish → real verify, form-bearing app (founder-walk-6 U1 / F4)', () => {
  let uploadedFiles: Array<{ path: string; content: Buffer }> = [];

  beforeEach(() => {
    uploadedFiles = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const reqUrl = String(input);
        const path = reqUrl === URL ? 'index.html' : reqUrl.slice(URL.length + 1);
        const f = uploadedFiles.find((x) => x.path === path);
        if (!f) return new Response('', { status: 404 });
        return new Response(new Uint8Array(f.content), { status: 200 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function deps(existing: OpsApp | null = null): PublishDeps {
    return {
      listFiles: vi.fn(async () => ['index.html']),
      getFileBytes: vi.fn(async () => ({ bytes: Buffer.from(ORIGINAL_HTML, 'utf8') })),
      scan: vi.fn(async () => passOutcome()),
      enqueueReview: vi.fn(),
      putAppFiles: vi.fn(async (_appId: string, files: Array<{ path: string; content: Buffer }>) => {
        uploadedFiles = files;
        return ok({ files: files.length, bytes: files.reduce((s, f) => s + f.content.length, 0) });
      }),
      setRoute: vi.fn(async () => ok({ name: NAME, appId: 'app-1', status: 'active' as const })),
      getRoute: vi.fn(async () => ok(null)),
      deleteRoute: vi.fn(async () => ok({ deleted: true })),
      // REAL verifier — this is the module under test, not a stub.
      verify: verifyHostedPublish,
      claimOpsApp: vi.fn(async () => existing ?? app({ status: 'provisioning' })),
      findOpsAppByName: vi.fn(async () => null),
      findOpsAppByProject: vi.fn(async () => existing),
      markOpsAppPublished: vi.fn(async () => true),
      markOpsAppFailed: vi.fn(async () => true),
      renameOpsApp: vi.fn(async () => true),
      appsDomain: () => DOMAIN,
      // REAL wiring, not a stub — the whole point is proving the real transform's
      // output is what gets verified.
      wireForms: ((files: Array<{ path: string; bytes: Buffer }>) =>
        wireForms(files, { endpoint: 'https://api.justgoblin.com', siteKey: '0xkey' })) as PublishDeps['wireForms'],
      provisionAppDatabase: vi.fn(async () => ({ ok: true as const, databaseId: 'db-1', jurisdiction: 'eu' as const })),
      setOpsAppD1Database: vi.fn(async () => true),
      teardownAppDatabase: vi.fn(async () => ({ attempted: false, gone: null })),
    } as unknown as PublishDeps;
  }

  it('verifies GREEN even though project storage still holds the pre-wiring bytes', async () => {
    const r = await publishHostedApp({ userId: 'user-1', projectId: 'proj-1', name: NAME }, deps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stage).toBe('live');
    expect(r.forms.wired).toEqual([{ path: 'index.html', formId: 'kontakt' }]);
    expect(r.verification.ok).toBe(true);
  });

  it('republishing an already-live form app is idempotent — verifies green again, same app/url', async () => {
    const first = await publishHostedApp({ userId: 'user-1', projectId: 'proj-1', name: NAME }, deps());
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const existing = app({ appId: first.appId, appName: first.name, status: 'active', d1DatabaseId: 'db-1' });
    const second = await publishHostedApp({ userId: 'user-1', projectId: 'proj-1', name: NAME }, deps(existing));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.stage).toBe('live');
    expect(second.republished).toBe(true);
    expect(second.appId).toBe(first.appId);
    expect(second.url).toBe(first.url);
    expect(second.verification.ok).toBe(true);
  });
});
