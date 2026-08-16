/**
 * AKT 2 · PHASE 3 · U3.1/U3.2 — the ORDER of the two stages, and what each may do
 * to the other's verdict.
 *
 * The fixture battery (hosted-publish-scan.test.ts) asks "does the scan get these
 * nine artifacts right". This file asks the structural questions the battery
 * cannot: does stage 2 ever run on a decided block, can it soften one, and does a
 * failed stage 2 hold rather than wave through.
 */

import { describe, it, expect, vi } from 'vitest';
import { runHostedPublishScan, type HostedScanFile, type TwoStageDeps } from './hosted-publish-scan';
import type { ClassifierResult } from './abuse-classifier';

const CLEAN: HostedScanFile[] = [
  { path: 'index.html', content: '<html><body><h1>Hallo</h1></body></html>', bytes: 40 },
];

const s1 = (verdict: 'pass' | 'block') => ({
  verdict,
  ...(verdict === 'block'
    ? { area: 'phishing' as const, message: 'Diese Veröffentlichung wurde gestoppt: …Nutzungsrichtlinie…' }
    : {}),
  ruleIds: verdict === 'block' ? ['PH-BRAND-CRED'] : [],
  hits: [],
  scannedFiles: 1,
  scannedBytes: 40,
});

const s2 = (over: Partial<ClassifierResult> = {}): ClassifierResult => ({
  verdict: 'pass',
  reason: 'clean',
  categories: [],
  confidence: 'high',
  tokens: { estimatedInput: 120, input: 700, output: 18 },
  sentChars: 480,
  model: 'deepseek-ai/DeepSeek-V3.2',
  tookMs: 400,
  ...over,
});

function deps(over: Partial<TwoStageDeps> = {}): TwoStageDeps {
  return {
    stage1: vi.fn(() => s1('pass')) as unknown as TwoStageDeps['stage1'],
    classify: vi.fn(async () => s2()),
    ...over,
  };
}

const ctx = { userId: 'u1', projectId: 'p1' };

describe('stage ordering', () => {
  it('a stage-1 block is final — stage 2 never runs and spends nothing', async () => {
    const d = deps({ stage1: vi.fn(() => s1('block')) as unknown as TwoStageDeps['stage1'] });
    const out = await runHostedPublishScan(CLEAN, ctx, d);
    expect(out.verdict).toBe('block');
    expect(out.decidedBy).toBe('stage1');
    expect(out.stage2).toBeNull();
    expect(d.classify).not.toHaveBeenCalled();
  });

  it('a stage-1 block keeps stage 1’s own German message and rule ids', async () => {
    const d = deps({ stage1: vi.fn(() => s1('block')) as unknown as TwoStageDeps['stage1'] });
    const out = await runHostedPublishScan(CLEAN, ctx, d);
    expect(out.message).toContain('Nutzungsrichtlinie');
    expect(out.ruleIds).toEqual(['PH-BRAND-CRED']);
    expect(out.area).toBe('phishing');
  });

  it('both stages passing is the only way to a pass', async () => {
    const out = await runHostedPublishScan(CLEAN, ctx, deps());
    expect(out.verdict).toBe('pass');
    expect(out.decidedBy).toBe('none');
    expect(out.stage2?.reason).toBe('clean');
    expect(out.message).toBeUndefined();
  });
});

describe('the third verdict', () => {
  it('a flagged artifact is held, with the category and a German message', async () => {
    const d = deps({ classify: vi.fn(async () => s2({ verdict: 'review', reason: 'flagged', categories: ['phishing'] })) });
    const out = await runHostedPublishScan(CLEAN, ctx, d);
    expect(out.verdict).toBe('review');
    expect(out.decidedBy).toBe('stage2');
    expect(out.categories).toEqual(['phishing']);
    expect(out.message).toContain('Hochgeladen wurde nichts');
  });

  it.each(['over_budget', 'unavailable', 'timeout', 'unparseable', 'error'] as const)(
    'a stage 2 that ended in %s HOLDS — it never falls through to pass',
    async (reason) => {
      const d = deps({ classify: vi.fn(async () => s2({ verdict: 'review', reason })) });
      const out = await runHostedPublishScan(CLEAN, ctx, d);
      expect(out.verdict).toBe('review');
      // And the builder is told the check did not finish, not that their app looked wrong.
      expect(out.message).toContain('Das sagt nichts über deine App aus');
    },
  );

  it('a stage 2 that was switched off passes, and says so rather than claiming a clean read', async () => {
    const d = deps({ classify: vi.fn(async () => s2({ reason: 'skipped', model: null })) });
    const out = await runHostedPublishScan(CLEAN, ctx, d);
    expect(out.verdict).toBe('pass');
    expect(out.stage2?.reason).toBe('skipped');
  });

  it('stage 2 cannot soften a stage-1 block, even by answering pass', async () => {
    const d = deps({
      stage1: vi.fn(() => s1('block')) as unknown as TwoStageDeps['stage1'],
      classify: vi.fn(async () => s2({ verdict: 'pass', reason: 'clean' })),
    });
    const out = await runHostedPublishScan(CLEAN, ctx, d);
    expect(out.verdict).toBe('block');
  });

  it('passes the context straight through to stage 1', async () => {
    const d = deps();
    await runHostedPublishScan(CLEAN, { userId: 'u1', projectId: null, appsDomain: 'justgoblin.app' }, d);
    expect(d.stage1).toHaveBeenCalledWith(CLEAN, expect.objectContaining({ projectId: null, appsDomain: 'justgoblin.app' }));
  });
});

// ── FOUNDER-WALK-6 · U2 (F2) — stage 1 and stage 2 can see DIFFERENT files ──

describe('classifierFiles / wiredFormCount (U2/F2)', () => {
  const WIRED: HostedScanFile[] = [
    { path: 'index.html', content: '<html><body><form data-goblin-form="a"></form><script>/* turnstile */</script></body></html>', bytes: 90 },
  ];
  const PRE_WIRING: HostedScanFile[] = [
    { path: 'index.html', content: '<html><body><form></form></body></html>', bytes: 40 },
  ];

  it('stage 1 always scans `files` — the real, uploaded bytes — regardless of classifierFiles', async () => {
    const d = deps();
    await runHostedPublishScan(WIRED, { userId: 'u1', classifierFiles: PRE_WIRING, wiredFormCount: 1 }, d);
    expect(d.stage1).toHaveBeenCalledWith(WIRED, expect.anything());
  });

  it('stage 2 reads classifierFiles INSTEAD of files, plus the wired form count, when both are given', async () => {
    const d = deps();
    await runHostedPublishScan(WIRED, { userId: 'u1', classifierFiles: PRE_WIRING, wiredFormCount: 2 }, d);
    expect(d.classify).toHaveBeenCalledWith(PRE_WIRING, undefined, 2);
  });

  it('omitting classifierFiles/wiredFormCount (the no-form case) is unchanged: stage 2 reads `files`, count 0', async () => {
    const d = deps();
    await runHostedPublishScan(CLEAN, ctx, d);
    expect(d.classify).toHaveBeenCalledWith(CLEAN, undefined, 0);
  });
});
