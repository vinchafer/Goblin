/**
 * AKT 2 · PHASE 3 · U3.5 — the battery's OFFLINE half.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE CAN PROVE WITHOUT A MODEL, AND WHAT IT CANNOT. Read this before
 * quoting any number from it.
 *
 * CAN, and does:
 *   1. Stage 1 lets every stage-2 fixture through. Without this the fixtures would
 *      not be testing stage 2 at all — they would be testing the regex list again.
 *   2. Stage 1 blocks NO legitimate fixture. This is the load-bearing half of the
 *      false-positive guard, and it is a complete proof rather than a sample:
 *      stage 2 CANNOT BLOCK — its vocabulary is pass|review — so the only layer
 *      that can end a legitimate builder's publish is the deterministic one, and
 *      that layer is exercised here in full.
 *   3. Every stage-2 fixture fits inside the token budget, so a `review` from the
 *      real model is a judgement and not an over-budget hold in disguise.
 *   4. The plumbing: a stage-2 `review` produces the German held-message and
 *      uploads nothing (ops-publish.test.ts owns the upload half).
 *
 * CANNOT:
 *   Whether the MODEL gets these ten right. That needs the model, and this session
 *   has no key and no permission to call one (real-model gates run against the
 *   deployed path with the test account). `scripts/scan-battery-stage2.mts` is
 *   that gate; it runs the same table 5× and reports the rate. Until it has been
 *   run, the stage-2 accuracy number is UNMEASURED and must be reported as such.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { scanHostedArtifact, runHostedPublishScan, type HostedScanFile, type TwoStageDeps } from './hosted-publish-scan';
import { classifierMaxInputTokens, extractCandidateText, type ClassifierResult } from './abuse-classifier';
import { BATTERY_V2, BATTERY_V2_DIR, FALSE_POSITIVE_GUARD, STAGE2_HOSTILE } from './hosted-scan-battery-v2';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), BATTERY_V2_DIR);

/** Load one fixture directory the way the publish path loads a project. */
export function loadFixtureV2(name: string): HostedScanFile[] {
  const root = join(ROOT, name);
  const out: HostedScanFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const content = readFileSync(full, 'utf8');
        out.push({ path: relative(root, full).split('\\').join('/'), content, bytes: Buffer.byteLength(content) });
      }
    }
  };
  walk(root);
  return out;
}

describe('the battery v2 is what it says it is', () => {
  it('has exactly the committed fixtures, 5 hostile and 5 legitimate', () => {
    const dirs = readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory());
    expect(dirs.sort()).toEqual(BATTERY_V2.map((b) => b.fixture).sort());
    expect(STAGE2_HOSTILE).toHaveLength(5);
    expect(FALSE_POSITIVE_GUARD).toHaveLength(5);
  });
});

// ── 1. The stage-2 fixtures really are invisible to stage 1 ─────────────────

describe('stage 1 cannot catch these — which is the point of them', () => {
  for (const c of STAGE2_HOSTILE) {
    it(`${c.fixture} passes the deterministic ruleset (${c.why})`, () => {
      const r = scanHostedArtifact(loadFixtureV2(c.fixture));
      // A fixture that stage 1 blocks is not a stage-2 fixture. If this ever goes
      // red because a NEW deterministic rule now catches it, that is good news and
      // the fixture should move to the Phase-2 battery, not be weakened here.
      expect({ fixture: c.fixture, verdict: r.verdict, rules: r.ruleIds }).toEqual({
        fixture: c.fixture, verdict: 'pass', rules: [],
      });
    });
  }
});

// ── 2. The false-positive guard, in the only place a block can come from ────

describe('the false-positive guard — no legitimate app is BLOCKED', () => {
  for (const c of FALSE_POSITIVE_GUARD) {
    it(`${c.fixture} is not blocked (${c.why})`, () => {
      const r = scanHostedArtifact(loadFixtureV2(c.fixture));
      expect({ fixture: c.fixture, verdict: r.verdict, rules: r.ruleIds }).toEqual({
        fixture: c.fixture, verdict: 'pass', rules: [],
      });
    });
  }

  it('and no legitimate app CAN be blocked by stage 2 — it has no such verdict', async () => {
    // The structural argument behind the claim above, made executable: even a
    // classifier that flagged everything with maximum confidence produces a HOLD.
    const paranoid: TwoStageDeps['classify'] = async (): Promise<ClassifierResult> => ({
      verdict: 'review', reason: 'flagged', categories: ['phishing', 'deception', 'malware'],
      confidence: 'high', tokens: { estimatedInput: 0, input: 0, output: 0 },
      sentChars: 0, model: 'test', tookMs: 0,
    });
    for (const c of FALSE_POSITIVE_GUARD) {
      const out = await runHostedPublishScan(loadFixtureV2(c.fixture), { userId: 'u1', projectId: 'p1' }, {
        stage1: (files) => scanHostedArtifact(files),
        classify: paranoid,
      });
      expect(out.verdict, c.fixture).toBe('review');
      expect(out.verdict, c.fixture).not.toBe('block');
    }
  });
});

// ── 3. A review from the real model will be a judgement, not a budget hold ──

describe('every fixture fits the token budget', () => {
  const max = classifierMaxInputTokens();
  for (const c of BATTERY_V2) {
    it(`${c.fixture} is inside the ${max}-token budget`, () => {
      const t = extractCandidateText(loadFixtureV2(c.fixture));
      expect({ fixture: c.fixture, over: t.overBudget }).toEqual({ fixture: c.fixture, over: false });
      // Also: it actually has text. A fixture the extractor sees as empty would be
      // held for "no readable content" and would look like a correct answer.
      expect(t.chars, c.fixture).toBeGreaterThan(200);
    });
  }

  it('reports the measured input size of the battery (the ledger M-A2 data point)', () => {
    const sizes = BATTERY_V2.map((c) => extractCandidateText(loadFixtureV2(c.fixture)).estimatedTokens);
    const mean = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    // Not an assertion about a good number — a floor and a ceiling, so a fixture
    // rewritten into something 10× larger cannot silently change the cost figure
    // the ledger quotes.
    expect(mean).toBeGreaterThan(50);
    expect(Math.max(...sizes)).toBeLessThan(max);
  });
});

// ── 4. The plumbing a stage-2 review goes through ───────────────────────────

describe('a stage-2 review, end to end through the scan', () => {
  const holds: TwoStageDeps['classify'] = async (): Promise<ClassifierResult> => ({
    verdict: 'review', reason: 'flagged', categories: ['deception'], confidence: 'medium',
    tokens: { estimatedInput: 200, input: 750, output: 20 }, sentChars: 800, model: 'test', tookMs: 300,
  });

  for (const c of STAGE2_HOSTILE) {
    it(`${c.fixture} → review, with a German message that names no mechanism`, async () => {
      const out = await runHostedPublishScan(loadFixtureV2(c.fixture), { userId: 'u1', projectId: 'p1' }, {
        stage1: (files) => scanHostedArtifact(files),
        classify: holds,
      });
      expect(out.verdict).toBe('review');
      expect(out.decidedBy).toBe('stage2');
      expect(out.message).toContain('Hochgeladen wurde nichts');
      for (const leak of ['deception', 'stage', 'Klassifizierer', 'confidence', 'medium']) {
        expect(out.message, `${c.fixture} leaks ${leak}`).not.toContain(leak);
      }
    });
  }
});
