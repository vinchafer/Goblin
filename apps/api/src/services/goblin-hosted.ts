/**
 * Goblin-bundled models — Layer 2 (canon), API-first (v6.1 pivot).
 *
 * The inverse of BYOK: the inference key lives SERVER-SIDE. Goblin pays a wholesale
 * per-token inference cost and bundles it into the subscription — "no key, no token
 * anxiety." Sourced from a wholesale per-token inference API (OpenAI-compatible
 * endpoint), NOT a self-hosted GPU pool. Routed through LiteLLM as a library
 * (no proxy deployed).
 *
 * FEATURE FLAG: `GOBLIN_HOSTED_API` (default: false). While false, every path here
 * is unreachable — `getGoblinHostedConfig()` returns null and the router never
 * selects Layer 2. No real key exists yet; the founder provisions the wholesale
 * account and flips the flag in Session 2. See infra/GOBLIN_HOSTED_ACTIVATION.md.
 *
 * Env (only read when the flag is on):
 *   GOBLIN_HOSTED_API             = 'true' to enable
 *   GOBLIN_HOSTED_BASE_URL        = wholesale OpenAI-compatible endpoint
 *   GOBLIN_HOSTED_API_KEY         = server-side wholesale key (secret)
 *   GOBLIN_HOSTED_MODEL_EFFICIENT = provider model id mapped to the default tier
 *   GOBLIN_HOSTED_MODEL_PREMIUM   = provider model id mapped to the premium tier
 *
 * Model branding is provider-agnostic: two Goblin-named tiers map to opaque
 * provider model IDs via env, so the wholesale provider behind them can be swapped
 * with zero UI change. The display names below are placeholders the founder renames.
 */

export type GoblinTierId = 'goblin/efficient' | 'goblin/premium';

export interface GoblinHostedTier {
  /** Stable Goblin-branded slug — used in the UI and for routing. */
  id: GoblinTierId;
  /** Display name (placeholder — founder can rename without touching routing). */
  name: string;
  description: string;
  /** Subscription plans that expose this tier. */
  plans: string[];
  /** Env var holding the provider-agnostic model id this tier maps to. */
  modelEnv: string;
  /** Placeholder provider model id if the env var is unset (founder overrides). */
  defaultModel: string;
  /** Cost class — drives default-vs-upsell policy (efficient is the default). */
  tierClass: 'efficient' | 'premium';
}

export const GOBLIN_HOSTED_TIERS: GoblinHostedTier[] = [
  {
    id: 'goblin/efficient',
    name: 'Goblin Swift',
    description: 'Goblin-bundled coding model — fast, efficient, no key required.',
    plans: ['build', 'pro', 'power'],
    modelEnv: 'GOBLIN_HOSTED_MODEL_EFFICIENT',
    defaultModel: 'efficient-coder',
    tierClass: 'efficient',
  },
  {
    id: 'goblin/premium',
    name: 'Goblin Forge',
    description: 'Goblin-bundled premium model — frontier-adjacent, Pro and Power plans.',
    plans: ['pro', 'power'],
    modelEnv: 'GOBLIN_HOSTED_MODEL_PREMIUM',
    defaultModel: 'premium-coder',
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

export function isGoblinHostedEnabled(): boolean {
  return process.env.GOBLIN_HOSTED_API === 'true';
}

export interface GoblinHostedConfig {
  baseURL: string;
  apiKey: string;
  defaultTier: GoblinHostedTier;
  /** Resolve a tier id → the provider-agnostic model id to send to the endpoint. */
  resolveModel: (tierId?: GoblinTierId) => string;
}

/**
 * Returns the server-side config ONLY when the flag is on and the endpoint + key
 * are both present. Misconfiguration returns null (stay off) — never throws, so a
 * half-set env can never break live routing.
 */
export function getGoblinHostedConfig(): GoblinHostedConfig | null {
  if (!isGoblinHostedEnabled()) return null;

  const baseURL = process.env.GOBLIN_HOSTED_BASE_URL;
  const apiKey = process.env.GOBLIN_HOSTED_API_KEY;
  if (!baseURL || !apiKey) return null;

  const resolveModel = (tierId?: GoblinTierId): string => {
    const tier = GOBLIN_HOSTED_TIERS.find((t) => t.id === tierId) ?? GOBLIN_DEFAULT_TIER;
    return process.env[tier.modelEnv] ?? tier.defaultModel;
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
