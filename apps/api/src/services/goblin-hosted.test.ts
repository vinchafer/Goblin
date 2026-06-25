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
  getGoblinHostedConfig,
  getGoblinHostedStatus,
  isGoblinHostedEnabled,
  parseGoblinTier,
  tierAllowedForPlan,
  assertOpenSourceModel,
  mapProviderError,
  modelDisplayName,
  getInvestorModelMapping,
  setGoblinClientFactory,
  resetGoblinClientFactory,
  type GoblinChatClient,
  type GoblinChatParams,
} from './goblin-hosted';
import { GOBLIN_DAILY_GUARD } from '../lib/goblin-cap';
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

  it('Forge is available on EVERY plan including trial (HR-2 — no model plan-gating)', () => {
    for (const p of ['trial', 'build', 'pro', 'power']) expect(tierAllowedForPlan(forge, p)).toBe(true);
  });

  // SESSION 5 (model-"(soon)" fix): the picker no longer gates on the plan string.
  // An unset / null / legacy plan (comped or fresh accounts, or a failed single-row
  // read) must NOT exclude the tier — that was the selectability blocker. The flag
  // is the only gate; spend is governed by the monthly allowance + trial-gate.
  it('an unset / null / unknown plan still gets both tiers (flag is the only gate)', () => {
    expect(tierAllowedForPlan(forge, undefined)).toBe(true);
    expect(tierAllowedForPlan(forge, null)).toBe(true);
    expect(tierAllowedForPlan(swift, '')).toBe(true);
    expect(tierAllowedForPlan(swift, 'comped')).toBe(true);
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

// (The per-day / monthly weighted guard math moved to lib/goblin-cap.ts and is
// covered exhaustively in goblin-cap.test.ts. The router-level enforcement is
// exercised end-to-end below.)

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

describe('streaming — both models on every plan (HR-2)', () => {
  beforeEach(() => {
    enableFlag();
    h.stub = makeSupabaseStub({
      byok_keys: { data: [] },
      completion_costs: { data: [] },
      agent_runs: { data: { id: 'run-1' } },
    });
  });

  for (const plan of ['trial', 'build', 'pro', 'power']) {
    it(`Forge streams on a ${plan} plan (no model plan-gating)`, async () => {
      h.stub = makeSupabaseStub({
        users: { data: { plan } },
        byok_keys: { data: [] },
        completion_costs: { data: [] },
        agent_runs: { data: { id: 'run-1' } },
      });
      setGoblinClientFactory(() => mockClient({ text: 'forged' }));
      const { streamCompletion } = await import('./model-router');
      const events = await collect(streamCompletion({
        userId: 'u1', projectId: null, message: 'heavy task', chatHistory: [],
        modelPreference: 'goblin/premium', supabase: h.stub as never,
      }));
      expect(events.find((e) => e.type === 'done')).toBeTruthy();
      expect(events.find((e) => e.type === 'error')).toBeUndefined();
      expect(lastParams!.model).toBe(DEFAULT_MODEL_PREMIUM);
    });
  }

  // SESSION 5 (model-"(soon)" fix): the picker/router no longer gate Goblin on the
  // plan string. An account whose `plan` reads back null/unset/unknown (a fresh,
  // comped, or anomalous row — the founder-walk blocker) must STILL be able to
  // select and stream both tiers; real spend/expiry is enforced by the monthly
  // allowance (goblin-cap) + trial-gate middleware, not by the model picker.
  for (const plan of [null, undefined, '', 'comped']) {
    it(`a ${JSON.stringify(plan)} plan still streams Goblin (no model plan-gating)`, async () => {
      h.stub = makeSupabaseStub({
        users: { data: { plan } },
        byok_keys: { data: [] },
        completion_costs: { data: [] },
        agent_runs: { data: { id: 'run-1' } },
      });
      setGoblinClientFactory(() => mockClient({ text: 'forged' }));
      const { streamCompletionGuarded } = await import('./model-router');
      const events = await collect(streamCompletionGuarded({
        userId: 'u1', projectId: null, message: 'x', chatHistory: [],
        modelPreference: 'goblin/premium', supabase: h.stub as never, timeoutMs: 5000,
      }));
      expect(events.find((e) => e.type === 'done')).toBeTruthy();
      expect(events.find((e) => e.type === 'error')).toBeUndefined();
      expect(lastParams!.model).toBe(DEFAULT_MODEL_PREMIUM);
    });
  }
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

describe('streaming — weighted fair-use enforcement (HR-3)', () => {
  beforeEach(enableFlag);

  const today = () => new Date().toISOString();

  it('refuses the NEXT run once the per-plan DAILY guard is exceeded (resets tomorrow)', async () => {
    h.stub = makeSupabaseStub({
      // A Pro user has an active subscription — required for the canonical
      // derivation (plan-truth.ts) to resolve 'pro' (no sub → 'none' → trial-level).
      users: { data: { plan: 'pro', preferred_lang: 'en', stripe_subscription_id: 'sub_test' } },
      byok_keys: { data: [] },
      // pro daily guard = 6M cost units; one Swift row today at the guard.
      completion_costs: { data: [{ model: 'goblin/efficient', tokens_in: GOBLIN_DAILY_GUARD.pro, tokens_out: 0, created_at: today() }] },
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
    expect(err!.code).toBe('daily_guard');
    expect(String(err!.message)).toMatch(/today's Goblin usage limit/i);
    expect(called).toBe(false); // never reached the provider — current run finished earlier, NEXT is refused
  });

  it('refuses the NEXT run once the MONTHLY allowance is reached (calm copy + reset date)', async () => {
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'trial', preferred_lang: 'en' } },
      byok_keys: { data: [] },
      // trial allowance = 4.9M; 5M Swift this month → over.
      completion_costs: { data: [{ model: 'goblin/efficient', tokens_in: 5_000_000, tokens_out: 0, created_at: today() }] },
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
    expect(err!.code).toBe('allowance_reached');
    expect(String(err!.message)).toMatch(/monthly Goblin allowance/i);
    expect(String(err!.message)).toMatch(/resets on/i);
    expect(called).toBe(false);
  });

  it('Forge usage trips the cap ~4.4× faster than the same Swift token count', async () => {
    // 1.2M Forge tokens this month on trial = 5.28M cost units → over the 4.9M trial cap.
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'trial', preferred_lang: 'de' } },
      byok_keys: { data: [] },
      completion_costs: { data: [{ model: 'goblin/premium', tokens_in: 1_200_000, tokens_out: 0, created_at: today() }] },
      agent_runs: { data: { id: 'run-1' } },
    });
    setGoblinClientFactory(() => mockClient({ text: 'x' }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/premium', supabase: h.stub as never,
    }));
    const err = events.find((e) => e.type === 'error');
    expect(err!.code).toBe('allowance_reached');
    // DE copy for a DE user
    expect(String(err!.message)).toMatch(/Goblin-Kontingent/i);
  });

  it('modest Swift usage on trial streams fine (under both daily + monthly)', async () => {
    // 1.2M Forge (above) tripped the trial cap; the same money in Swift goes ~4.4×
    // further — 400K Swift is comfortably under the 1.0M daily and 4.9M monthly.
    h.stub = makeSupabaseStub({
      users: { data: { plan: 'trial', preferred_lang: 'de' } },
      byok_keys: { data: [] },
      completion_costs: { data: [{ model: 'goblin/efficient', tokens_in: 400_000, tokens_out: 0, created_at: today() }] },
      agent_runs: { data: { id: 'run-1' } },
    });
    setGoblinClientFactory(() => mockClient({ text: 'ok', inputTokens: 5, outputTokens: 5 }));
    const { streamCompletion } = await import('./model-router');
    const events = await collect(streamCompletion({
      userId: 'u1', projectId: null, message: 'x', chatHistory: [],
      modelPreference: 'goblin/efficient', supabase: h.stub as never,
    }));
    expect(events.find((e) => e.type === 'done')).toBeTruthy();
    expect(events.find((e) => e.type === 'error')).toBeUndefined();
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

// ════════════════════════════════════════════════════════════════════════════
// Investor model mapping (single source of truth — HR-2/HR-3)
// ════════════════════════════════════════════════════════════════════════════

describe('modelDisplayName', () => {
  it('maps the known wholesale slugs to readable labels', () => {
    expect(modelDisplayName('deepseek-ai/DeepSeek-V3.2')).toBe('DeepSeek V3.2');
    expect(modelDisplayName('moonshotai/Kimi-K2.6')).toBe('Kimi K2.6');
  });

  it('degrades an unknown slug to its last path segment, humanized', () => {
    expect(modelDisplayName('meta-llama/Llama-3.3-70B')).toBe('Llama 3.3 70B');
    expect(modelDisplayName('bare-slug-name')).toBe('bare slug name');
  });
});

describe('getInvestorModelMapping (single source of truth)', () => {
  it('returns the real Swift/Forge → underlying-model mapping from config', () => {
    const m = getInvestorModelMapping();
    expect(m.swift.label).toBe('Goblin Swift');
    expect(m.swift.slug).toBe(DEFAULT_MODEL_EFFICIENT);
    expect(m.swift.model).toBe('DeepSeek V3.2');
    expect(m.swift.tierClass).toBe('efficient');

    expect(m.forge.label).toBe('Goblin Forge');
    expect(m.forge.slug).toBe(DEFAULT_MODEL_PREMIUM);
    expect(m.forge.model).toBe('Kimi K2.6');
    expect(m.forge.tierClass).toBe('premium');
  });

  it('follows the env override — change the config, the mapping changes (no second copy)', () => {
    process.env.GOBLIN_HOSTED_MODEL_PREMIUM = 'Qwen/Qwen2.5-Coder-32B-Instruct';
    const m = getInvestorModelMapping();
    expect(m.forge.slug).toBe('Qwen/Qwen2.5-Coder-32B-Instruct');
    expect(m.forge.model).toBe('Qwen2.5 Coder 32B Instruct');
  });

  it('reports the mapping even with the user-facing flag OFF (it is config, not live routing)', () => {
    delete process.env.GOBLIN_HOSTED_API;
    delete process.env.DEEPINFRA_API_KEY;
    const m = getInvestorModelMapping();
    expect(m.swift.slug).toBe(DEFAULT_MODEL_EFFICIENT);
    expect(m.forge.slug).toBe(DEFAULT_MODEL_PREMIUM);
  });

  it('NEVER returns the wholesale provider name or any key', () => {
    process.env.DEEPINFRA_API_KEY = 'super-secret-key-value';
    const blob = JSON.stringify(getInvestorModelMapping()).toLowerCase();
    expect(blob).not.toContain('deepinfra');
    expect(blob).not.toContain('super-secret-key-value');
    expect(blob).not.toContain('apikey');
  });
});
