// FEEL-3b B1 gate: the publish adapter over a MOCKED deploy pipeline.
// Proves the two honesty properties §5.1/§5.2 demands:
//   • a green deploy + green truth-gate → ok:true with the VERIFIED url in the result;
//   • a truth-gate red for a missing asset → ok:false naming the failed asset (never a
//     silent success), and read_deploy_status then reports that failure verbatim.
// Also proves publish saves drafts BEFORE deploying (we publish what was written) and
// that a NO_VERCEL_TOKEN deploy is a structured, honest failure — not a throw.

import { describe, it, expect } from 'vitest';
import { runPublish, readDeployStatus, newPublishState, type PublishDeps } from './publish';
import type { ToolContext } from './types';

const ctx: ToolContext = { userId: 'u1', projectId: 'p1', sessionId: 's1' };
const noSleep = async () => {};

/** A deploy pipeline that always builds green; verifyDeployment verdict is injected. */
function deps(verify: PublishDeps['verifyDeployment'], deploy?: Partial<PublishDeps>): PublishDeps {
  return {
    deployToVercel: async () => ({ deploymentId: 'dep_1', url: 'https://x.vercel.app' }),
    getDeployStatus: async () => ({ state: 'READY', url: 'https://p1.vercel.app' }),
    verifyDeployment: verify,
    listFiles: async () => ['index.html', 'styles.css'],
    ...deploy,
  };
}

function run(overrides?: Partial<Parameters<typeof runPublish>[1]>) {
  return {
    promoteDrafts: async () => ({ ok: true }),
    projectName: async () => 'my-app',
    markDeployed: async () => {},
    sleep: noSleep,
    ...overrides,
  };
}

describe('publish — B1', () => {
  it('green deploy + green gate → ok with the verified URL', async () => {
    const state = newPublishState();
    const res = await runPublish(deps(async () => ({ ok: true, failedAssets: [] })), run(), ctx, state, () => {});
    expect(res.ok).toBe(true);
    expect(res.summary).toContain('Live ✓');
    expect((res.data as { url: string }).url).toBe('https://p1.vercel.app');
    expect(state.verifiedUrl).toBe('https://p1.vercel.app');
    expect(state.lastError).toBeUndefined();
  });

  it('persists the verified URL on the project row', async () => {
    const state = newPublishState();
    let marked: { pid: string; url: string } | null = null;
    await runPublish(
      deps(async () => ({ ok: true, failedAssets: [] })),
      run({ markDeployed: async (pid, url) => { marked = { pid, url }; } }),
      ctx,
      state,
      () => {},
    );
    expect(marked).toEqual({ pid: 'p1', url: 'https://p1.vercel.app' });
  });

  it('red truth-gate for a missing asset → structured failure naming the asset', async () => {
    const state = newPublishState();
    const res = await runPublish(
      deps(async () => ({ ok: false, reason: 'Veröffentlichung hat ein Problem: styles.css nicht erreichbar', failedAssets: ['styles.css'] })),
      run(),
      ctx,
      state,
      () => {},
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('verify_failed');
    expect(res.summary).toContain('styles.css');
    expect((res.data as { failedAssets: string[] }).failedAssets).toEqual(['styles.css']);
    expect(state.lastError).toContain('styles.css');
    expect(state.lastFailedAssets).toEqual(['styles.css']);
  });

  it('saves drafts BEFORE deploying — a save failure aborts with an honest reason', async () => {
    const state = newPublishState();
    let deployed = false;
    const res = await runPublish(
      deps(async () => ({ ok: true, failedAssets: [] }), {
        deployToVercel: async () => { deployed = true; return { deploymentId: 'd', url: 'u' }; },
      }),
      run({ promoteDrafts: async () => ({ ok: false, error: 'Speicher voll' }) }),
      ctx,
      state,
      () => {},
    );
    expect(res.ok).toBe(false);
    expect(deployed).toBe(false); // never reached the deploy
    expect(res.summary).toContain('Speicher voll');
  });

  it('a NO_VERCEL_TOKEN deploy is an honest structured failure, not a throw', async () => {
    const state = newPublishState();
    const res = await runPublish(
      deps(async () => ({ ok: true, failedAssets: [] }), {
        deployToVercel: async () => { throw new Error('NO_VERCEL_TOKEN — Du brauchst einen eigenen Vercel-Account'); },
      }),
      run(),
      ctx,
      state,
      () => {},
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('no_vercel_token');
  });

  it('a build ERROR during polling → structured deploy failure', async () => {
    const state = newPublishState();
    const res = await runPublish(
      deps(async () => ({ ok: true, failedAssets: [] }), {
        getDeployStatus: async () => ({ state: 'ERROR' }),
      }),
      run(),
      ctx,
      state,
      () => {},
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('deploy_failed');
  });

  it('read_deploy_status reflects a live URL after a green publish', () => {
    const state = newPublishState();
    state.verifiedUrl = 'https://p1.vercel.app';
    const r = readDeployStatus(state, { previewUrl: null, lastDeployedAt: '2026-07-09' });
    expect((r.data as { status: string }).status).toBe('live');
    expect((r.data as { url: string }).url).toBe('https://p1.vercel.app');
  });

  it('read_deploy_status reports the last publish error verbatim', () => {
    const state = newPublishState();
    state.lastError = 'styles.css nicht erreichbar';
    const r = readDeployStatus(state, { previewUrl: null, lastDeployedAt: null });
    expect((r.data as { status: string }).status).toBe('fehlgeschlagen');
    expect(r.summary).toContain('styles.css nicht erreichbar');
    expect((r.data as { lastError: string }).lastError).toBe('styles.css nicht erreichbar');
  });

  it('counts publish attempts for the self-heal budget', async () => {
    const state = newPublishState();
    const d = deps(async () => ({ ok: false, reason: 'x', failedAssets: ['a'] }));
    await runPublish(d, run(), ctx, state, () => {});
    await runPublish(d, run(), ctx, state, () => {});
    expect(state.attempts).toBe(2);
  });
});
