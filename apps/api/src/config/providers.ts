// Provider and static model definitions for Goblin.
//
// 10.9-A2 — HAND-MAINTAINED DISPLAY LIST (OPTION B; see sprint-10-9/PHASE_0_GATE.md).
//
// Two distinct things live here:
//  1. Provider METADATA (baseURL, keyEnvVar, litellmPrefix, docs/credits URLs) —
//     routing infrastructure. Stable; edit only when a provider changes its API.
//  2. The `models: [...]` arrays — a small, curated, hand-maintained DISPLAY list.
//     Their JOB is the not-connected onboarding view ("here's what you can
//     connect", shown greyed). They are NOT the routing source-of-truth: for a
//     connected key, routing slugs come from per-user provider-discovery
//     (byok_keys.discovered_models), sent to the provider VERBATIM (hard slug
//     rule). The only time a static slug reaches a provider is the safety
//     fallback when discovery is unavailable for a connected key — keep the
//     curated slugs correct, but treat this list as display-first.
//
// Vincent edits this ~quarterly. Keep it tiny and obvious: one file, the
// PROVIDERS map below, a handful of headline models per provider. No proxy,
// no /v1/models, no auto-generation.

export type ProviderId =
  | 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral'
  | 'xai' | 'deepseek' | 'together' | 'fireworks' | 'openrouter' | 'custom';

export type ModelLayer = 'byok' | 'free_api' | 'goblin_hosted';

export interface StaticModelDef {
  id: string;
  name: string;
  slug: string;
  provider: ProviderId;
  layer: ModelLayer;
  description: string;
  tags: string[];
  requires_key: boolean;
  available: boolean;
  phase: number;
}

export interface ProviderConfig {
  id: ProviderId;
  displayName: string;
  litellmPrefix: string;
  baseURL: string;
  keyEnvVar: string;
  keyHint: string;
  docsUrl: string;
  hasCreditsApi: boolean;
  creditsApiUrl?: string;
  models: StaticModelDef[];
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic',
    litellmPrefix: 'anthropic/',
    baseURL: 'https://api.anthropic.com/v1',
    keyEnvVar: 'ANTHROPIC_API_KEY',
    keyHint: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    hasCreditsApi: false,
    models: [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', slug: 'anthropic/claude-opus-4-5', provider: 'anthropic', layer: 'byok', description: 'Most powerful Claude. Best for complex reasoning and long contexts.', tags: ['reasoning', 'coding', 'powerful'], requires_key: true, available: true, phase: 1 },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', slug: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', layer: 'byok', description: 'Fast, highly capable. Best for most coding tasks.', tags: ['coding', 'fast', 'balanced'], requires_key: true, available: true, phase: 1 },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', slug: 'anthropic/claude-haiku-4-5', provider: 'anthropic', layer: 'byok', description: 'Fastest, cheapest Claude. Great for quick tasks.', tags: ['fast', 'cheap'], requires_key: true, available: true, phase: 1 },
    ],
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    litellmPrefix: 'openai/',
    baseURL: 'https://api.openai.com/v1',
    keyEnvVar: 'OPENAI_API_KEY',
    keyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    hasCreditsApi: true,
    creditsApiUrl: 'https://api.openai.com/dashboard/billing/subscription',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', slug: 'openai/gpt-4o', provider: 'openai', layer: 'byok', description: 'OpenAI flagship. Strong at code and instruction following.', tags: ['coding', 'fast', 'balanced'], requires_key: true, available: true, phase: 1 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', slug: 'openai/gpt-4o-mini', provider: 'openai', layer: 'byok', description: 'Small, fast, cheap. Great for simple tasks.', tags: ['fast', 'cheap'], requires_key: true, available: true, phase: 1 },
      { id: 'o1', name: 'o1', slug: 'openai/o1', provider: 'openai', layer: 'byok', description: 'Extended reasoning model. Best for complex math/logic.', tags: ['reasoning', 'powerful'], requires_key: true, available: true, phase: 1 },
      { id: 'o3-mini', name: 'o3-mini', slug: 'openai/o3-mini', provider: 'openai', layer: 'byok', description: 'Efficient reasoning model. Fast and capable.', tags: ['reasoning', 'fast'], requires_key: true, available: true, phase: 1 },
    ],
  },
  google: {
    id: 'google',
    displayName: 'Google AI Studio',
    litellmPrefix: 'gemini/',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    keyEnvVar: 'GOOGLE_API_KEY',
    keyHint: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    hasCreditsApi: false,
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', slug: 'gemini/gemini-2.0-flash', provider: 'google', layer: 'byok', description: 'Very fast. Great for quick iterations. Generous free tier.', tags: ['fast', 'free'], requires_key: true, available: true, phase: 1 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', slug: 'gemini/gemini-1.5-pro', provider: 'google', layer: 'byok', description: 'Long context (1M tokens). Great for large codebases.', tags: ['long-context', 'coding'], requires_key: true, available: true, phase: 1 },
    ],
  },
  groq: {
    id: 'groq',
    displayName: 'Groq',
    litellmPrefix: 'groq/',
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnvVar: 'GROQ_API_KEY',
    keyHint: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    hasCreditsApi: false,
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', slug: 'groq/llama-3.3-70b-versatile', provider: 'groq', layer: 'byok', description: 'Open-source 70B. Extremely fast via Groq inference.', tags: ['fast', 'coding', 'open-source'], requires_key: true, available: true, phase: 1 },
      { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', slug: 'groq/mixtral-8x7b-32768', provider: 'groq', layer: 'byok', description: 'MoE model. Fast and multilingual.', tags: ['fast', 'multilingual'], requires_key: true, available: true, phase: 1 },
    ],
  },
  mistral: {
    id: 'mistral',
    displayName: 'Mistral AI',
    litellmPrefix: 'mistral/',
    baseURL: 'https://api.mistral.ai/v1',
    keyEnvVar: 'MISTRAL_API_KEY',
    keyHint: '...',
    docsUrl: 'https://console.mistral.ai/api-keys',
    hasCreditsApi: true,
    creditsApiUrl: 'https://api.mistral.ai/v1/usage',
    models: [
      { id: 'mistral-large', name: 'Mistral Large', slug: 'mistral/mistral-large-latest', provider: 'mistral', layer: 'byok', description: 'Flagship Mistral. Strong multilingual and coding support.', tags: ['multilingual', 'coding'], requires_key: true, available: true, phase: 1 },
      { id: 'mistral-small', name: 'Mistral Small', slug: 'mistral/mistral-small-latest', provider: 'mistral', layer: 'byok', description: 'Efficient Mistral model. Cost-effective for most tasks.', tags: ['fast', 'cheap'], requires_key: true, available: true, phase: 1 },
    ],
  },
  xai: {
    id: 'xai',
    displayName: 'xAI',
    litellmPrefix: 'xai/',
    baseURL: 'https://api.x.ai/v1',
    keyEnvVar: 'XAI_API_KEY',
    keyHint: 'xai-...',
    docsUrl: 'https://console.x.ai/',
    hasCreditsApi: false,
    models: [
      { id: 'grok-3', name: 'Grok 3', slug: 'xai/grok-3', provider: 'xai', layer: 'byok', description: 'Latest Grok. Powerful reasoning and real-time knowledge.', tags: ['reasoning', 'knowledge'], requires_key: true, available: true, phase: 1 },
      { id: 'grok-3-mini', name: 'Grok 3 Mini', slug: 'xai/grok-3-mini', provider: 'xai', layer: 'byok', description: 'Compact Grok. Fast and cost-effective.', tags: ['fast', 'cheap'], requires_key: true, available: true, phase: 1 },
    ],
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    litellmPrefix: 'deepseek/',
    baseURL: 'https://api.deepseek.com/v1',
    keyEnvVar: 'DEEPSEEK_API_KEY',
    keyHint: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    hasCreditsApi: false,
    models: [
      { id: 'deepseek-v3', name: 'DeepSeek V3', slug: 'deepseek/deepseek-chat', provider: 'deepseek', layer: 'byok', description: 'Best price/performance for coding. Near frontier quality.', tags: ['coding', 'cheap', 'fast'], requires_key: true, available: true, phase: 1 },
      { id: 'deepseek-r1', name: 'DeepSeek R1', slug: 'deepseek/deepseek-reasoner', provider: 'deepseek', layer: 'byok', description: 'Chain-of-thought reasoning model. Open-weights.', tags: ['reasoning', 'open-source'], requires_key: true, available: true, phase: 1 },
    ],
  },
  together: {
    id: 'together',
    displayName: 'Together AI',
    litellmPrefix: 'together_ai/',
    baseURL: 'https://api.together.xyz/v1',
    keyEnvVar: 'TOGETHER_API_KEY',
    keyHint: '...',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
    hasCreditsApi: true,
    creditsApiUrl: 'https://api.together.xyz/v1/usage',
    models: [
      { id: 'llama-3.3-70b-turbo', name: 'Llama 3.3 70B (Together)', slug: 'together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo', provider: 'together', layer: 'byok', description: 'Open-source 70B via Together. Access many open models.', tags: ['open-source', 'coding'], requires_key: true, available: true, phase: 1 },
    ],
  },
  fireworks: {
    id: 'fireworks',
    displayName: 'Fireworks AI',
    litellmPrefix: 'fireworks_ai/',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    keyEnvVar: 'FIREWORKS_API_KEY',
    keyHint: 'fw-...',
    docsUrl: 'https://fireworks.ai/account/api-keys',
    hasCreditsApi: false,
    models: [
      { id: 'llama-v3p3-70b', name: 'Llama 3.3 70B (Fireworks)', slug: 'fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct', provider: 'fireworks', layer: 'byok', description: 'Fast open-source 70B via Fireworks inference.', tags: ['fast', 'open-source', 'coding'], requires_key: true, available: true, phase: 1 },
    ],
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    litellmPrefix: 'openrouter/',
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnvVar: 'OPENROUTER_API_KEY',
    keyHint: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/keys',
    hasCreditsApi: false,
    models: [],
  },
  custom: {
    id: 'custom',
    displayName: 'Custom Endpoint',
    litellmPrefix: '',
    baseURL: '',
    keyEnvVar: 'CUSTOM_API_KEY',
    keyHint: '...',
    docsUrl: '',
    hasCreditsApi: false,
    models: [],
  },
};

// All static models flattened
export const ALL_STATIC_MODELS: StaticModelDef[] = Object.values(PROVIDERS).flatMap(p => p.models);

// Free API pool (company keys, no user key needed)
export const FREE_API_MODELS: StaticModelDef[] = [
  { id: 'gemini-2.0-flash-free', name: 'Gemini 2.0 Flash', slug: 'free/gemini-flash', provider: 'google', layer: 'free_api', description: 'Fast, generous free tier. No key required.', tags: ['fast', 'free'], requires_key: false, available: true, phase: 1 },
  { id: 'llama-3.3-70b-free', name: 'Llama 3.3 70B', slug: 'free/llama-70b', provider: 'groq', layer: 'free_api', description: 'Extremely fast inference. Free tier available.', tags: ['fast', 'free', 'coding'], requires_key: false, available: true, phase: 1 },
];

// OpenAI-compatible base URLs for direct API calls (no LiteLLM)
export const PROVIDER_BASE_URLS: Partial<Record<ProviderId, string>> = Object.fromEntries(
  Object.entries(PROVIDERS).map(([id, p]) => [id, p.baseURL])
) as Partial<Record<ProviderId, string>>;

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS[id as ProviderId];
}

export function getModelBySlug(slug: string): StaticModelDef | undefined {
  return ALL_STATIC_MODELS.find(m => m.slug === slug);
}
