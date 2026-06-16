/**
 * Goblin-bundled models — Layer 2 (canon), API-first (v6.1 pivot). SESSION 2: LIVE.
 *
 * The inverse of BYOK: the inference key lives SERVER-SIDE. Goblin pays a wholesale
 * per-token inference cost and bundles it into the subscription — "no key, no token
 * anxiety." Sourced from a US wholesale per-token inference API (OpenAI-compatible
 * endpoint), routed through the OpenAI SDK as a library (no proxy deployed).
 *
 * PROVIDER (policy / investor surface only — NEVER named on a marketing surface,
 * see HR-6): DeepInfra. US data centers, SOC 2 / ISO 27001, zero-retention for the
 * open-source models used. Transfer mechanism: SCCs. Storage stays EU (B2).
 *
 * FEATURE FLAG: `GOBLIN_HOSTED_API` (default: false). While false, every path here
 * is unreachable — `getGoblinHostedConfig()` returns null and the router never
 * selects Layer 2.
 *
 * SECRET (HR-1): the wholesale key lives ONLY in Railway env var `DEEPINFRA_API_KEY`.
 * Local .env holds a placeholder. The key is read from `process.env.DEEPINFRA_API_KEY`
 * at runtime and never logged, printed, or committed.
 *
 * Env (only read when the flag is on):
 *   GOBLIN_HOSTED_API             = 'true' to enable
 *   DEEPINFRA_API_KEY             = server-side wholesale key (secret; Railway only)
 *   GOBLIN_HOSTED_BASE_URL        = override endpoint (defaults to DeepInfra OpenAI-compat)
 *   GOBLIN_HOSTED_MODEL_EFFICIENT = provider model slug for the default tier (Swift)
 *   GOBLIN_HOSTED_MODEL_PREMIUM   = provider model slug for the premium tier (Forge)
 *
 * Model branding is provider-agnostic: two Goblin-named tiers map to opaque provider
 * model slugs, so the wholesale provider behind them can be swapped with zero UI
 * change. "Goblin Swift" / "Goblin Forge" are the public names; the provider slug
 * never reaches the browser (two-level truth — the router records the tier id, not
 * the slug).
 */

import OpenAI from 'openai';
import { GoblinError } from './litellm-client';

export type GoblinTierId = 'goblin/efficient' | 'goblin/premium';

/** DeepInfra OpenAI-compatible endpoint (US). Overridable; defaulted so the founder
 *  only needs to set the secret key in Railway. */
export const DEEPINFRA_DEFAULT_BASE_URL = 'https://api.deepinfra.com/v1/openai';

/**
 * Locked model choices (founder decision; slugs are env-overridable so a slug
 * correction needs no code change). Confirmed live against the /models endpoint at
 * Stage B. BOTH are open-source — the hard invariant below fails closed if a tier
 * is ever pointed at a proprietary (Google / Anthropic / OpenAI) model, whose
 * training/retention terms would break the zero-retention story.
 *   Swift → DeepSeek V3.2  (default tier, supports context caching)
 *   Forge → Kimi K2.6      (premium tier, Pro/Power plans)
 */
export const DEFAULT_MODEL_EFFICIENT = 'deepseek-ai/DeepSeek-V3.2';
export const DEFAULT_MODEL_PREMIUM = 'moonshotai/Kimi-K2.6';

/**
 * Fail-closed invariant: a Goblin tier may NEVER resolve to a proprietary model.
 * Matched against the resolved provider slug. DeepInfra's open-source slugs
 * (deepseek-ai/…, moonshotai/…, meta-llama/…, Qwen/…) never trip this.
 */
const FORBIDDEN_MODEL_RE =
  /(^|[/_-])(google|anthropic|gemini|claude|gpt-|gpt3|gpt4|chatgpt|palm|openai\/)/i;

export interface GoblinHostedTier {
  /** Stable Goblin-branded slug — used in the UI and for routing. */
  id: GoblinTierId;
  /** Public display name. */
  name: string;
  description: string;
  /** Subscription plans that expose this tier. */
  plans: string[];
  /** Env var holding the provider model slug this tier maps to. */
  modelEnv: string;
  /** Default provider model slug if the env var is unset. */
  defaultModel: string;
  /** Cost class — efficient is the default; premium is the upsell. */
  tierClass: 'efficient' | 'premium';
}

export const GOBLIN_HOSTED_TIERS: GoblinHostedTier[] = [
  {
    id: 'goblin/efficient',
    name: 'Goblin Swift',
    description: 'Goblin-bundled coding model — fast, light, no key required.',
    // The default "no key, just build" tier — available during the trial and on
    // every paid plan. Spend is bounded by the monthly cap + per-day guard, so
    // there is no margin reason to lock trials out of the wedge experience.
    plans: ['trial', 'build', 'pro', 'power'],
    modelEnv: 'GOBLIN_HOSTED_MODEL_EFFICIENT',
    defaultModel: DEFAULT_MODEL_EFFICIENT,
    tierClass: 'efficient',
  },
  {
    id: 'goblin/premium',
    name: 'Goblin Forge',
    description: 'Goblin-bundled premium model — stronger, for heavier work. Pro and Power plans.',
    plans: ['pro', 'power'],
    modelEnv: 'GOBLIN_HOSTED_MODEL_PREMIUM',
    defaultModel: DEFAULT_MODEL_PREMIUM,
    tierClass: 'premium',
  },
];

/** The efficient tier is always the default (existential condition #2). */
export const GOBLIN_DEFAULT_TIER = GOBLIN_HOSTED_TIERS[0]!;

/** Back-compat shape for catalog/UI consumers (id/name/description/plans). */
export const GOBLIN_HOSTED_MODELS = GOBLIN_HOSTED_TIERS.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  plans: t.plans,
}));

// ─── HR-3 defensive guards (no test or real loop can drain the $10 balance) ─────

/** Per-request OUTPUT token ceiling sent to the provider on every call. */
export const GOBLIN_MAX_TOKENS_PER_REQUEST = 8096;

/** Per-user PER-DAY token ceiling (in + out) for the Goblin-hosted tier. A runaway
 *  — test or real — trips this long before it can drain the balance. Enforced in
 *  the router via a same-day completion_costs sum (no migration needed). */
export const GOBLIN_MAX_TOKENS_PER_DAY = 5_000_000;

/** Pure threshold check (unit-testable; the DB sum is done by the caller). */
export function isOverDailyTokenCeiling(tokensUsedToday: number): boolean {
  if (!Number.isFinite(tokensUsedToday) || tokensUsedToday <= 0) return false;
  return tokensUsedToday >= GOBLIN_MAX_TOKENS_PER_DAY;
}

// ─── Flag + config ──────────────────────────────────────────────────────────

export function isGoblinHostedEnabled(): boolean {
  return process.env.GOBLIN_HOSTED_API === 'true';
}

/** Parse a routing slug into a Goblin tier id, or null if it isn't one. */
export function parseGoblinTier(slug?: string | null): GoblinTierId | null {
  if (slug === 'goblin/efficient' || slug === 'goblin/premium') return slug;
  return null;
}

/** Is this tier exposed on the given subscription plan? (plan-gating, HR plans) */
export function tierAllowedForPlan(tier: GoblinHostedTier, plan?: string | null): boolean {
  const p = (plan ?? '').toLowerCase();
  return tier.plans.includes(p);
}

/**
 * Assert the open-source invariant for a resolved provider slug. Throws a
 * GoblinError if a tier is pointed at a proprietary model. (Fail closed.)
 */
export function assertOpenSourceModel(model: string, tierId: string): void {
  if (FORBIDDEN_MODEL_RE.test(model)) {
    throw new GoblinError(
      'unknown',
      `Goblin tier "${tierId}" may not map to a proprietary model. Open-source only (zero-retention invariant).`,
    );
  }
}

export interface GoblinHostedConfig {
  baseURL: string;
  apiKey: string;
  defaultTier: GoblinHostedTier;
  /** Resolve a tier id → the provider model slug to send to the endpoint.
   *  Enforces the open-source invariant; throws if violated. */
  resolveModel: (tierId?: GoblinTierId) => string;
}

/**
 * Returns the server-side config ONLY when the flag is on and the secret key is
 * present, AND both tier models satisfy the open-source invariant. Any
 * misconfiguration returns null (stay off) — never throws — so a half-set env or a
 * forbidden model can never break live routing; the user falls back to BYOK / the
 * "no model connected" path instead of hitting a proprietary provider.
 */
export function getGoblinHostedConfig(): GoblinHostedConfig | null {
  if (!isGoblinHostedEnabled()) return null;

  const baseURL = process.env.GOBLIN_HOSTED_BASE_URL || DEEPINFRA_DEFAULT_BASE_URL;
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) return null;

  // Pre-validate BOTH tier models so a forbidden mapping fails closed (no routing).
  try {
    for (const tier of GOBLIN_HOSTED_TIERS) {
      assertOpenSourceModel(process.env[tier.modelEnv] ?? tier.defaultModel, tier.id);
    }
  } catch {
    return null; // invariant violation → Layer 2 stays off
  }

  const resolveModel = (tierId?: GoblinTierId): string => {
    const tier = GOBLIN_HOSTED_TIERS.find((t) => t.id === tierId) ?? GOBLIN_DEFAULT_TIER;
    const model = process.env[tier.modelEnv] ?? tier.defaultModel;
    assertOpenSourceModel(model, tier.id);
    return model;
  };

  return { baseURL, apiKey, defaultTier: GOBLIN_DEFAULT_TIER, resolveModel };
}

export function getGoblinHostedStatus(): {
  enabled: boolean;
  status: 'active' | 'coming_soon' | 'misconfigured';
} {
  if (!isGoblinHostedEnabled()) return { enabled: false, status: 'coming_soon' };
  return getGoblinHostedConfig()
    ? { enabled: true, status: 'active' }
    : { enabled: false, status: 'misconfigured' };
}

// ─── Streaming client (injectable for deterministic Stage-A mock testing) ───────

export interface GoblinChatParams {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GoblinChatChunk {
  type: 'delta' | 'usage';
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface GoblinChatClient {
  stream(params: GoblinChatParams): AsyncGenerator<GoblinChatChunk>;
}

/**
 * Real DeepInfra client over the OpenAI-compatible endpoint. Maps provider failures
 * to GoblinError so the router can degrade gracefully (never a raw stack trace to
 * the user). Context caching, where the provider supports it (DeepSeek), is applied
 * transparently server-side by the provider — no special param required.
 */
export function realGoblinClient(config: GoblinHostedConfig): GoblinChatClient {
  return {
    async *stream(params: GoblinChatParams): AsyncGenerator<GoblinChatChunk> {
      const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      try {
        stream = await client.chat.completions.create({
          model: params.model,
          messages: params.messages,
          max_tokens: params.maxTokens ?? GOBLIN_MAX_TOKENS_PER_REQUEST,
          stream: true,
          stream_options: { include_usage: true },
        }, { signal: params.signal });
      } catch (err) {
        throw mapProviderError(err);
      }

      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) yield { type: 'delta', content: text };
          if (chunk.usage) {
            yield {
              type: 'usage',
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };
          }
        }
      } catch (err) {
        throw mapProviderError(err);
      }
    },
  };
}

/** Map an OpenAI-SDK / network failure to a GoblinError (calm, code-tagged). */
export function mapProviderError(err: unknown): GoblinError {
  const status = (err as { status?: number })?.status;
  const name = (err as { name?: string })?.name;
  if (name === 'AbortError') return new GoblinError('timeout', 'Request timed out');
  if (status === 429) return new GoblinError('rate_limit', 'Rate limit reached. Please retry in a moment.');
  if (status === 401 || status === 403) return new GoblinError('invalid_key', 'Goblin model service is unavailable.');
  if (status === 402) return new GoblinError('provider_down', 'Goblin model service is temporarily unavailable.');
  if (status === 404) return new GoblinError('model_not_found', 'Goblin model is unavailable.');
  if (typeof status === 'number' && status >= 500) return new GoblinError('provider_down', 'Goblin model service is temporarily unavailable.');
  const msg = err instanceof Error ? err.message : 'Goblin model request failed';
  return new GoblinError('unknown', msg);
}

// Injectable factory so Stage-A tests can substitute a deterministic mock without
// touching the network. Defaults to the real DeepInfra client.
let goblinClientFactory: (config: GoblinHostedConfig) => GoblinChatClient = realGoblinClient;

export function getGoblinClient(config: GoblinHostedConfig): GoblinChatClient {
  return goblinClientFactory(config);
}

export function setGoblinClientFactory(factory: (config: GoblinHostedConfig) => GoblinChatClient): void {
  goblinClientFactory = factory;
}

export function resetGoblinClientFactory(): void {
  goblinClientFactory = realGoblinClient;
}
