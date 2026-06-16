/**
 * Layer-2 "API-First" — STAGE A: exhaustive deterministic mock test (HR-3).
 *
 * Everything here runs against a deterministic mock of the wholesale (DeepInfra)
 * provider behind the SAME GoblinChatClient interface as the real client — no
 * network, no spend. The matrix: tier→model resolution, the fail-closed open-source
 * invariant, plan-gating, the defensive guards, provider-error mapping, and the
 * end-to-end streaming path (happy + every injected error) with a stubbed Supabase.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GOBLIN_HOSTED_TIERS,
  GOBLIN_DEFAULT_TIER,
  DEFAULT_MODEL_EFFICIENT,
  DEFAULT_MODEL_PREMIUM,
  GOBLIN_MAX_TOKENS_PER_DAY,
  getGoblinHostedConfig,
  getGoblinHostedStatus,
  isGoblinHostedEnabled,
  parseGoblinTier,
  tierAllowedForPlan,
  assertOpenSourceModel,
  isOverDailyTokenCeiling,
  mapProviderError,
  setGoblinClientFactory,
  resetGoblinClientFactory,
  type GoblinChatClient,
  type GoblinChatParams,
} from './goblin-hosted';
import { GoblinError } from './litellm-client';

// ─── Deterministic mock of the wholesale provider ──────────────────────────────

interface MockSpec {
  text?: string;            // streamed reply (split into deltas)
  inputTokens?: number;
  outputTokens?: number;
  throwAt?: 'open' | 'mid'; // throw before first chunk, or after one delta
  error?: GoblinError;
}

let lastParams: GoblinChatParams | null = null;

function mockClient(spec: MockSpec): GoblinChatClient {
  return {
    async *stream(params: GoblinChatParams) {
      lastParams = params;
      if (spec.throwAt === 'open') throw spec.error ?? new GoblinError('unknown', 'mock open error');
      const text = spec.text ?? 'hello world';
      const words = text.split(' ');
      for (let i = 0; i < words.length; i++) {
        yield { type: 'delta' as const, content: (i === 0 ? '' : ' ') + words[i] };
        if (spec.throwAt === 'mid' && i === 0) throw spec.error ?? new GoblinError('provider_down', 'mock mid error');
      }
      yield {
        type: 'usage' as const,
        inputTokens: spec.inputTokens ?? 10,
        outputTokens: spec.outputTokens ?? 5,
      };
    },
  };
}

// ─── Supabase stub (thenable query builder) ────────────────────────────────────

class FakeQuery {
  constructor(private result: { data: unknown; error?: unknown }) {}
  select() { return this; }
  insert() { return this; }
  update() { return this; }
  eq() { return this; }
  gte() { return this; }
  lte() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }
  single() { return Promise.resolve(this.result); }
  maybeSingle() { return Promise.resolve(this.result); }
  then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(onF, onR);
  }
}

function makeSupabaseStub(responses: Record<string, { data: unknown; error?: unknown }>) {
  const inserted: Array<{ table: string; row: unknown }> = [];
  const stub = {
    inserted,
    from(table: string) {
      const q = new FakeQuery(responses[table] ?? { data: null });
      const origInsert = q.insert.bind(q);
      q.insert = (row?: unknown) => { inserted.push({ table, row }); return origInsert(); };
      return q;
    },
  };
  return stub;
}

const h = vi.hoisted(() => ({ stub: null as unknown }));
vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => h.stub }));

// ─── Env helpers ───────────────────────────────────────────────────────────────

const ORIG = { ...process.env };
function enableFlag() {
  process.env.GOBLIN_HOSTED_API = 'true';
  process.env.DEEPINFRA_API_KEY = 'placeholder-test-key';
  delete process.env.GOBLIN_HOSTED_BASE_URL;
  delete process.env.GOBLIN_HOSTED_MODEL_EFFICIENT;
  delete process.env.GOBLIN_HOSTED_MODEL_PREMIUM;
  delete process.env.LITELLM_BASE_URL;
}

afterEach(() => {
  process.env = { ...ORIG };
  resetGoblinClientFactory();
  lastParams = null;
});

// ════════════════════════════════════════════════════════════════════════════
// 1. Tier → model resolution + the fail-closed open-source invariant
// ════════════════════════════════════════════════════════════════════════════

describe('tier → model resolution', () => {
  beforeEach(enableFlag);

  it('Swift resolves to DeepSeek V3.2 (default tier)', () => {
    const cfg = getGoblinHostedConfig()!;
    expect(cfg).not.toBeNull();
    expect(GOBLIN_DEFAULT_TIER.id).toBe('goblin/efficient');
    expect(cfg.resolveModel('goblin/efficient')).toBe(DEFAULT_MODEL_EFFICIENT);
    expect(DEFAULT_MODEL_EFFICIENT).toMatch(/deepseek/i);
  });

  it('Forge resolves to Kimi K2.6 (premium tier)', () => {
    const cfg = getGoblinHostedConfig()!;
    expect(cfg.resolveModel('goblin/premium')).toBe(DEFAULT_MODEL_PREMIUM);
    expect(DEFAULT_MODEL_PREMIUM).toMatch(/kimi/i);
  });

  it('unknown tier falls back to the default (Swift)', () => {
    const cfg = getGoblinHostedConfig()!;
    expect(cfg.resolveModel(undefined)).toBe(DEFAULT_MODEL_EFFICIENT);
  });

  it('env override swaps the slug without code change', () => {
    process.env.GOBLIN_HOSTED_MODEL_EFFICIENT = 'Qwen/Qwen2.5-Coder-32B-Instruct';
    const cfg = getGoblinHostedConfig()!;
    expect(cfg.resolveModel('goblin/efficient')).toBe('Qwen/Qwen2.5-Coder-32B-Instruct');
  });
});

describe('fail-closed open-source invariant', () => {
  beforeEach(enableFlag);

  it('accepts open-source slugs', () => {
    expect(() => assertOpenSourceModel('deepseek-ai/DeepSeek-V3.2', 'goblin/efficient')).not.toThrow();
    expect(() => assertOpenSourceModel('moonshotai/Kimi-K2.6', 'goblin/premium')).not.toThrow();
    expect(() => assertOpenSourceModel('meta-llama/Llama-3.3-70B', 'goblin/efficient')).not.toThrow();
    expect(() => assertOpenSourceModel('Qwen/Qwen2.5-Coder', 'goblin/efficient')).not.toThrow();
  });

  it('rejects Google / Anthropic / OpenAI mappings', () => {
    expect(() => assertOpenSourceModel('google/gemini-2.0-flash', 'x')).toThrow(GoblinError);
    expect(() => assertOpenSourceModel('anthropic/claude-3', 'x')).toThrow(GoblinError);
    expect(() => assertOpenSourceModel('gpt-4o', 'x')).toThrow(GoblinError);
    expect(() => assertOpenSourceModel('openai/gpt-4o-mini', 'x')).toThrow(GoblinError);
    expect(() => assertOpenSourceModel('some/claude-sonnet', 'x')).toThrow(GoblinError);
  });

  it('getGoblinHostedConfig fails closed (null) when a tier is pointed at a forbidden model', () => {
    process.env.GOBLIN_HOSTED_MODEL_PREMIUM = 'anthropic/claude-3-opus';
    expect(getGoblinHostedConfig()).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Flag gating + status
// ════════════════════════════════════════════════════════════════════════════

describe('flag gating', () => {
  it('disabled when flag off', () => {
    delete process.env.GOBLIN_HOSTED_API;
    expect(isGoblinHostedEnabled()).toBe(false);
    expect(getGoblinHostedConfig()).toBeNull();
    expect(getGoblinHostedStatus()).toEqual({ enabled: false, status: 'coming_soon' });
  });

  it('misconfigured (flag on, no key) → null + misconfigured status', () => {
    process.env.GOBLIN_HOSTED_API = 'true';
    delete process.env.DEEPINFRA_API_KEY;
    expect(getGoblinHostedConfig()).toBeNull();
    expect(getGoblinHostedStatus()).toEqual({ enabled: false, status: 'misconfigured' });
  });

  it('active when flag on + key present', () => {
    enableFlag();
    expect(getGoblinHostedStatus()).toEqual({ enabled: true, status: 'active' });
  });

  it('defaults the base URL to the DeepInfra endpoint', () => {
    enableFlag();
    expect(getGoblinHostedConfig()!.baseURL).toMatch(/deepinfra\.com/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Plan-gating
// ════════════════════════════════════════════════════════════════════════════

describe('plan-gating', () => {
  const swift = GOBLIN_HOSTED_TIERS.find((t) => t.id === 'goblin/efficient')!;
  const forge = GOBLIN_HOSTED_TIERS.find((t) => t.id === 'goblin/premium')!;

  it('Swift is available on the trial and every paid plan (the no-key wedge)', () => {
    for (const p of ['trial', 'build', 'pro', 'power']) expect(tierAllowedForPlan(swift, p)).toBe(true);
  });

  it('Forge is gated to Pro and Power (trial excluded)', () => {
    expect(tierAllowedForPlan(forge, 'trial')).toBe(false);
    expect(tierAllowedForPlan(forge, 'build')).toBe(false);
    expect(tierAllowedForPlan(forge, 'pro')).toBe(true);
    expect(tierAllowedForPlan(forge, 'power')).toBe(true);
  });

  it('a free / missing plan is excluded from both tiers (free pool, not Goblin-hosted)', () => {
    expect(tierAllowedForPlan(forge, undefined)).toBe(false);
    expect(tierAllowedForPlan(forge, 'free')).toBe(false);
    expect(tierAllowedForPlan(swift, 'free')).toBe(false);
    expect(tierAllowedForPlan(swift, undefined)).toBe(false);
  });

  it('parseGoblinTier only recognizes the two tier slugs', () => {
    expect(parseGoblinTier('goblin/efficient')).toBe('goblin/efficient');
    expect(parseGoblinTier('goblin/premium')).toBe('goblin/premium');
    expect(parseGoblinTier('anthropic/claude-3')).toBeNull();
    expect(parseGoblinTier(undefined)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Guards
// ════════════════════════════════════════════════════════════════════════════

describe('defensive guards (HR-3)', () => {
  it('per-day ceiling fires at/over the limit only', () => {
    expect(isOverDailyTokenCeiling(0)).toBe(false);
    expect(isOverDailyTokenCeiling(GOBLIN_MAX_TOKENS_PER_DAY - 1)).toBe(false);
    expect(isOverDailyTokenCeiling(GOBLIN_MAX_TOKENS_PER_DAY)).toBe(true);
    expect(isOverDailyTokenCeiling(GOBLIN_MAX_TOKENS_PER_DAY + 1)).toBe(true);
  });

  it('is defensive against malformed input', () => {
    expect(isOverDailyTokenCeiling(Number.NaN)).toBe(false);
    expect(isOverDailyTokenCeiling(-5)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Provider-error mapping (calm, code-tagged — never a raw stack trace)
// ════════════════════════════════════════════════════════════════════════════

describe('mapProviderError', () => {
  const cases: Array<[unknown, string]> = [
    [{ status: 429 }, 'rate_limit'],
    [{ status: 401 }, 'invalid_key'],
    [{ status: 403 }, 'invalid_key'],
    [{ status: 402 }, 'provider_down'],
    [{ status: 404 }, 'model_not_found'],
    [{ status: 500 }, 'provider_down'],
    [{ status: 503 }, 'provider_down'],
    [{ name: 'AbortError' }, 'timeout'],
    [new Error('socket hang up'), 'unknown'],
  ];
  for (const [input, code] of cases) {
    it(`maps ${JSON.stringify(input)} → ${code}`, () => {
      const e = mapProviderError(input);
      expect(e).toBeInstanceOf(GoblinError);
      expect(e.code).toBe(code);
      expect(e.message).not.toMatch(/stack|at Object|node_modules/i);
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 6. End-to-end streaming via the router (mock client + stubbed Supabase)
// ════════════════════════════════════════════════════════════════════════════

async function collect(gen: AsyncGenerator<string>): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for await (const s of gen) { try { out.push(JSON.parse(s)); } catch { /* skip */ } }
  return out;
}

describe('streaming — happy path', () => {
  beforeEach(() => {
    enableFlag();
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'pro' } },
      byok_keys: { data: [] },
      completion_costs: { data: [] },
      agent_runs: { data: { id: 'run-1' } },
    });
  });

  it('Swift: streams, records tokens, never leaks the provider slug', async () => {
    setGoblinClientFactory(() => mockClient({ text: 'hi there', inputTokens: 100, outputTokens: 40 }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'build me a thing', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never,
    }));

    const meta = events.find((e) => e.type === 'meta')!;
    expect(meta.source_tier).toBe('goblin_hosted');
    expect(meta.model).toBe('goblin/efficient');       // tier id, NOT the slug
    const done = events.find((e) => e.type === 'done')!;
    expect(done.input_tokens).toBe(100);
    expect(done.output_tokens).toBe(40);
    expect(done.model_used).toBe('goblin/efficient');

    // Two-level truth: the DeepSeek slug must appear NOWHERE in the client stream…
    const blob = JSON.stringify(events).toLowerCase();
    expect(blob).not.toContain('deepseek');
    expect(blob).not.toContain('deepinfra');
    // …yet the provider received the real slug on the wire.
    expect(lastParams!.model).toBe(DEFAULT_MODEL_EFFICIENT);
  });

  it('Forge: routes to Kimi on a Pro plan', async () => {
    setGoblinClientFactory(() => mockClient({ text: 'forged' }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'heavy task', chatHistory: [],
      modelPreference: 'goblin/premium', supabase: h.stub as never,
    }));
    expect(events.find((e) => e.type === 'done')).toBeTruthy();
    expect(lastParams!.model).toBe(DEFAULT_MODEL_PREMIUM);
    const blob = JSON.stringify(events).toLowerCase();
    expect(blob).not.toContain('kimi');
    expect(blob).not.toContain('moonshot');
  });

  it('Swift works on a TRIAL plan (the no-key wedge — Stage-B regression)', async () => {
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'trial' } },
      byok_keys: { data: [] },
      completion_costs: { data: [] },
      agent_runs: { data: { id: 'run-1' } },
    });
    setGoblinClientFactory(() => mockClient({ text: 'a goblin is a small creature' }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'what is a goblin?', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never,
    }));
    expect(events.find((e) => e.type === 'done')).toBeTruthy();
    expect(events.find((e) => e.type === 'error')).toBeUndefined();
  });

  it('records a completion_costs row with source_tier goblin_hosted', async () => {
    setGoblinClientFactory(() => mockClient({ inputTokens: 7, outputTokens: 3 }));
    const { streamCompletion } = await import('./model-router');
    await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never,
    }));
    const costRow = (h.stub as ReturnType<typeof makeSupabaseStub>).inserted
      .find((i) => i.table === 'completion_costs');
    expect(costRow).toBeTruthy();
    expect((costRow!.row as { source_tier: string }).source_tier).toBe('goblin_hosted');
    expect((costRow!.row as { model: string }).model).toBe('goblin/efficient');
  });
});

describe('streaming — plan-gating refusal', () => {
  beforeEach(() => {
    enableFlag();
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'build' } }, // Forge not allowed
      byok_keys: { data: [] },
      completion_costs: { data: [] },
      agent_runs: { data: { id: 'run-1' } },
    });
  });

  it('Forge on Build is cleanly refused (error event, not a crash)', async () => {
    // Through the GUARDED wrapper — the path the chat route actually uses. A
    // resolveModel refusal surfaces as a calm error event, never an unhandled throw.
    setGoblinClientFactory(() => mockClient({}));
    const { streamCompletionGuarded } = await import('./model-router');
    const events = await collect(streamCompletionGuarded({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/premium', supabase: h.stub as never, timeoutMs: 5000,
    }));
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeTruthy();
    expect(String(err!.message)).toMatch(/Pro and Power/i);
  });
});

describe('streaming — injected error states (graceful degrade)', () => {
  beforeEach(() => {
    enableFlag();
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'pro' } },
      byok_keys: { data: [] },
      completion_costs: { data: [] },
      agent_runs: { data: { id: 'run-1' } },
    });
  });

  const errs: Array<[string, GoblinError]> = [
    ['timeout', new GoblinError('timeout', 'Request timed out')],
    ['429', new GoblinError('rate_limit', 'Rate limit reached. Please retry in a moment.')],
    ['5xx', new GoblinError('provider_down', 'Goblin model service is temporarily unavailable.')],
    ['402', new GoblinError('provider_down', 'Goblin model service is temporarily unavailable.')],
  ];

  for (const [label, error] of errs) {
    it(`${label}: emits a calm error event, no throw, no raw stack`, async () => {
      setGoblinClientFactory(() => mockClient({ throwAt: 'open', error }));
      const { streamCompletion } = await import('./model-router');
      const events = await collect(streamCompletion({
        userId: 'u1', projectId: null, message: 'x', chatHistory: [],
        modelPreference: 'goblin/efficient', supabase: h.stub as never,
      }));
      const err = events.find((e) => e.type === 'error');
      expect(err, `${label} should emit an error event`).toBeTruthy();
      expect(String(err!.message)).toBe(error.message);
      expect(String(err!.message)).not.toMatch(/at Object|node_modules|\.ts:\d+/);
    });
  }

  it('malformed mid-stream failure still terminates with an error event', async () => {
    setGoblinClientFactory(() => mockClient({ throwAt: 'mid', error: new GoblinError('provider_down', 'stream broke') }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never,
    }));
    expect(events.find((e) => e.type === 'error')).toBeTruthy();
  });
});

describe('streaming — per-day drain guard', () => {
  beforeEach(enableFlag);

  it('refuses cleanly once the daily token ceiling is exceeded', async () => {
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'pro' } },
      byok_keys: { data: [] },
      // already over the daily ceiling today
      completion_costs: { data: [{ tokens_in: GOBLIN_MAX_TOKENS_PER_DAY, tokens_out: 0 }] },
      agent_runs: { data: { id: 'run-1' } },
    });
    let called = false;
    setGoblinClientFactory(() => ({ async *stream() { called = true; } }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never,
    }));
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeTruthy();
    expect(String(err!.message)).toMatch(/Limit/i);
    expect(called).toBe(false); // never reached the provider
  });
});

describe('streaming — flag off: never selects Layer 2', () => {
  it('an explicit goblin pick with the flag off falls through to the no-model error', async () => {
    delete process.env.GOBLIN_HOSTED_API;
    delete process.env.DEEPINFRA_API_KEY;
    h.stub = makeSupabaseStub({ users: { data: { plan: 'pro' } }, byok_keys: { data: [] } });
    const { streamCompletionGuarded } = await import('./model-router');
    // No goblin route (flag off) + no BYOK key → the guarded wrapper surfaces the
    // "No AI model connected" refusal as a calm error event (never silently routes
    // Layer 2). HR-8: goblin-hosted is added, never a default.
    const events = await collect(streamCompletionGuarded({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never, timeoutMs: 5000,
    }));
    expect(events.find((e) => e.type === 'done')).toBeUndefined();
    expect(String(events.find((e) => e.type === 'error')?.message)).toMatch(/No AI model connected/i);
  });
});
