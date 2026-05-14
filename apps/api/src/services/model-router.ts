import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { type SupabaseClient } from '@supabase/supabase-js';
import { getGoblinHostedConfig } from './goblin-hosted';
import { decryptData, decryptUserData } from './encryption';
import { getSupabaseAdmin } from '../lib/supabase';
import { PROVIDERS, PROVIDER_BASE_URLS, type ProviderId } from '../config/providers';
import { GoblinError, isGoblinError, litellmStream } from './litellm-client';
import { formatTokenDisplay } from '../config/pricing';

export type { GoblinError };
export { isGoblinError };

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelLayer = 'byok' | 'free_api' | 'goblin_hosted';
export type ProviderName = ProviderId;

export interface RouteResult {
  layer: ModelLayer;
  provider: ProviderName;
  apiKey: string;
  baseURL: string;
  model: string;
  modelSlug: string;
  // LiteLLM-native model name for pass-through routing (provider/model format)
  litellmModel: string;
}

// ─── Free-API Pool ────────────────────────────────────────────────────────────

interface FreePoolEntry {
  provider: ProviderName;
  envVar: string;
  baseURL: string;
  model: string;
  slug: string;
  // LiteLLM-native model identifier (provider/model format for pass-through routing)
  litellmModel: string;
}

const FREE_API_POOL: FreePoolEntry[] = [
  { provider: 'google',   envVar: 'GOOGLE_FREE_API_KEY',     baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.0-flash',        slug: 'free/gemini-flash',        litellmModel: 'gemini/gemini-2.0-flash' },
  { provider: 'groq',     envVar: 'GROQ_FREE_API_KEY',       baseURL: 'https://api.groq.com/openai/v1',                          model: 'llama-3.3-70b-versatile', slug: 'free/llama-70b',           litellmModel: 'groq/llama-3.3-70b-versatile' },
  { provider: 'openai',   envVar: 'CEREBRAS_FREE_API_KEY',   baseURL: 'https://api.cerebras.ai/v1',                              model: 'llama-3.3-70b',           slug: 'free/llama-70b-cerebras',  litellmModel: 'cerebras/llama-3.3-70b' },
  { provider: 'deepseek', envVar: 'OPENROUTER_FREE_API_KEY', baseURL: 'https://openrouter.ai/api/v1',                            model: 'deepseek/deepseek-chat',  slug: 'free/deepseek',            litellmModel: 'openrouter/deepseek/deepseek-chat' },
];

// Provider priority for auto-selection
export const PROVIDER_PRIORITY: ProviderName[] = ['anthropic', 'openai', 'deepseek', 'groq', 'mistral', 'google', 'xai', 'together'];

// Backwards-compat: OpenAI-compatible base URLs
export const OPENAI_COMPATIBLE: Record<string, { baseURL: string; defaultModel: string }> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .filter(([id]) => id !== 'anthropic' && id !== 'custom')
    .map(([id, p]) => [id, { baseURL: p.baseURL, defaultModel: p.models[0]?.id ?? 'gpt-4o' }])
) as Record<string, { baseURL: string; defaultModel: string }>;

// ─── Key resolution ───────────────────────────────────────────────────────────

async function resolveByokKey(
  userId: string,
  preferredProvider?: ProviderName,
  preferredModel?: string,
  supabase?: SupabaseClient,
): Promise<{ provider: ProviderName; apiKey: string } | null> {
  const sb = supabase ?? getSupabaseAdmin();

  const [keysResult, userResult] = await Promise.all([
    sb
      .from('byok_keys')
      .select('provider, key_encrypted')
      .eq('user_id', userId)
      .eq('status', 'active'),
    sb
      .from('users')
      .select('encryption_salt')
      .eq('id', userId)
      .single(),
  ]);

  const keys = keysResult.data;
  if (!keys || keys.length === 0) return null;

  const userSalt = (userResult.data as { encryption_salt?: string } | null)?.encryption_salt ?? null;

  function safeDecrypt(encrypted: string): string {
    try {
      if (userSalt) {
        try {
          return decryptUserData(encrypted, userSalt);
        } catch {
          // Fall through to legacy
        }
      }
      return decryptData(encrypted);
    } catch {
      throw new GoblinError('decryption_error', 'API key needs to be re-entered. Please go to Settings → API Keys.');
    }
  }

  if (preferredProvider) {
    const match = keys.find(k => k.provider === preferredProvider);
    if (match) return { provider: match.provider as ProviderName, apiKey: safeDecrypt(match.key_encrypted) };
  }

  // Single key: auto-select it without further lookup
  if (keys.length === 1) {
    const only = keys[0]!;
    return { provider: only.provider as ProviderName, apiKey: safeDecrypt(only.key_encrypted) };
  }

  // Multiple keys: check user's saved default provider preference
  const { data: userRow } = await sb
    .from('users')
    .select('default_chat_model')
    .eq('id', userId)
    .single();

  if (userRow?.default_chat_model) {
    const defaultProvider = slugToProvider(userRow.default_chat_model as string);
    if (defaultProvider) {
      const match = keys.find(k => k.provider === defaultProvider);
      if (match) return { provider: match.provider as ProviderName, apiKey: safeDecrypt(match.key_encrypted) };
    }
  }

  for (const provider of PROVIDER_PRIORITY) {
    const match = keys.find(k => k.provider === provider);
    if (match) return { provider, apiKey: safeDecrypt(match.key_encrypted) };
  }

  const first = keys[0]!;
  return { provider: first.provider as ProviderName, apiKey: safeDecrypt(first.key_encrypted) };
}

function resolveFreeApi(): (FreePoolEntry & { provider: ProviderName }) | null {
  for (const entry of FREE_API_POOL) {
    const key = process.env[entry.envVar];
    if (key) return { ...entry, apiKey: key } as FreePoolEntry & { provider: ProviderName } & { apiKey: string };
  }
  return null;
}

// Map modelSlug prefix to provider
function slugToProvider(slug: string): ProviderName | undefined {
  const prefix = slug.split('/')[0];
  if (!prefix) return undefined;
  const providerMap: Record<string, ProviderName> = {
    'anthropic': 'anthropic', 'openai': 'openai', 'gemini': 'google',
    'groq': 'groq', 'mistral': 'mistral', 'xai': 'xai',
    'deepseek': 'deepseek', 'together_ai': 'together', 'fireworks_ai': 'fireworks',
    'openrouter': 'openrouter',
  };
  return providerMap[prefix];
}

// Extract the actual model ID from a slug (strip provider prefix)
function slugToModelId(slug: string): string {
  const parts = slug.split('/');
  if (parts.length <= 1) return slug;
  // together_ai/meta-llama/... → meta-llama/...
  if (parts[0] === 'together_ai' || parts[0] === 'fireworks_ai') {
    return parts.slice(1).join('/');
  }
  return parts.slice(1).join('/');
}

// ─── Route resolution ─────────────────────────────────────────────────────────

export async function resolveModel(
  userId: string,
  preferredModel?: string,
  supabase?: SupabaseClient,
): Promise<RouteResult> {
  let preferredProvider: ProviderName | undefined;
  let modelId: string | undefined;

  if (preferredModel) {
    preferredProvider = slugToProvider(preferredModel);
    modelId = slugToModelId(preferredModel);
  }

  // Layer 3: BYOK
  const byok = await resolveByokKey(userId, preferredProvider, preferredModel, supabase);
  if (byok) {
    const providerCfg = PROVIDERS[byok.provider];
    const baseURL = providerCfg?.baseURL ?? '';
    const defaultModel = providerCfg?.models[0]?.id ?? 'gpt-4o';
    const resolvedModel = modelId ?? defaultModel;
    const slug = preferredModel ?? `${byok.provider}/${resolvedModel}`;
    return {
      layer: 'byok',
      provider: byok.provider,
      apiKey: byok.apiKey,
      baseURL,
      model: resolvedModel,
      modelSlug: slug,
      litellmModel: slug, // provider/model format, LiteLLM routes natively
    };
  }

  // Layer 2: Free-API Pool
  const free = resolveFreeApi();
  if (free) {
    return {
      layer: 'free_api',
      provider: free.provider,
      apiKey: (free as unknown as { apiKey: string }).apiKey,
      baseURL: free.baseURL,
      model: free.model,
      modelSlug: free.slug,
      litellmModel: free.litellmModel, // provider-prefixed for LiteLLM pass-through
    };
  }

  // Layer 1: Goblin Hosted (Phase 3)
  const hosted = getGoblinHostedConfig();
  if (hosted) {
    return {
      layer: 'goblin_hosted',
      provider: 'openai',
      apiKey: hosted.apiKey,
      baseURL: hosted.endpoint,
      model: 'goblin-hosted-llama-3.3-70b',
      modelSlug: 'goblin/llama-3.3-70b',
      litellmModel: 'openai/goblin-hosted-llama-3.3-70b',
    };
  }

  throw new GoblinError('unknown', 'No model connected. Add an API key in Settings to start chatting.');
}

// ─── Streaming ────────────────────────────────────────────────────────────────

interface StreamCompletionParams {
  userId: string;
  projectId?: string | null;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
  modelPreference?: string;
  supabase?: SupabaseClient;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function* streamCompletion({
  userId,
  projectId,
  message,
  chatHistory,
  modelPreference,
  supabase,
  timeoutMs = 120_000,
  signal,
}: StreamCompletionParams): AsyncGenerator<string, void, unknown> {
  const route = await resolveModel(userId, modelPreference, supabase);

  const messages = [
    ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  let inputTokens = 0;
  let outputTokens = 0;

  yield JSON.stringify({
    type: 'meta',
    source_tier: route.layer,
    model: route.model,
    model_slug: route.modelSlug,
    provider: route.provider,
  });

  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? getSupabaseAdmin();

  const { data: agentRun } = await sb
    .from('agent_runs')
    .insert({ user_id: userId, project_id: projectId, model_used: route.model, source_tier: route.layer, status: 'running' })
    .select().single();

  // Try LiteLLM first if configured
  const litellmBase = process.env.LITELLM_BASE_URL;
  if (litellmBase) {
    try {
      for await (const delta of litellmStream(route.litellmModel, messages, { apiKey: route.apiKey, timeout: timeoutMs, signal })) {
        if (delta.type === 'delta' && delta.content) {
          yield JSON.stringify({ type: 'delta', content: delta.content });
        } else if (delta.type === 'usage') {
          inputTokens = delta.input_tokens ?? 0;
          outputTokens = delta.output_tokens ?? 0;
        }
      }
      // Done — emit token info
      const tokenDisplay = formatTokenDisplay(inputTokens, outputTokens, route.layer, route.modelSlug);
      if (agentRun) {
        await sb.from('agent_runs').update({ status: 'success', input_tokens: inputTokens, output_tokens: outputTokens, completed_at: new Date().toISOString() }).eq('id', agentRun.id);
      }
      yield JSON.stringify({ type: 'done', input_tokens: inputTokens, output_tokens: outputTokens, token_display: tokenDisplay, source_tier: route.layer, model_used: route.model });
      return;
    } catch (err) {
      if (!isGoblinError(err) || (err.code !== 'rate_limit' && err.code !== 'provider_down')) {
        throw err; // Hard error (invalid key, etc.) — propagate
      }
      // Soft error (rate limit / down) — fall through to direct API
      yield JSON.stringify({ type: 'fallback_notice', reason: err.message });
    }
  }

  // Direct SDK fallback
  try {
    if (route.provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: route.apiKey });
      const model = route.model;
      const stream = await anthropic.messages.create({ model, max_tokens: 8096, messages, stream: true });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield JSON.stringify({ type: 'delta', content: event.delta.text });
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }
    } else {
      const openai = new OpenAI({ apiKey: route.apiKey, baseURL: route.baseURL });
      const model = route.model;
      const stream = await openai.chat.completions.create({ model, max_tokens: 8096, messages, stream: true, stream_options: { include_usage: true } });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) yield JSON.stringify({ type: 'delta', content: text });
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }
    }

    const tokenDisplay = formatTokenDisplay(inputTokens, outputTokens, route.layer, route.modelSlug);
    if (agentRun) {
      await sb.from('agent_runs').update({ status: 'success', input_tokens: inputTokens, output_tokens: outputTokens, completed_at: new Date().toISOString() }).eq('id', agentRun.id);
    }
    yield JSON.stringify({ type: 'done', input_tokens: inputTokens, output_tokens: outputTokens, token_display: tokenDisplay, source_tier: route.layer, model_used: route.model });
  } catch (err: unknown) {
    if (agentRun) {
      await sb.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', agentRun.id);
    }
    const msg = isGoblinError(err) ? err.message : (err instanceof Error ? err.message : 'Stream failed');
    yield JSON.stringify({ type: 'error', message: msg });
  }
}

// ─── Fallback chain persistence ───────────────────────────────────────────────

export async function saveFallbackChain(userId: string, chain: string[], supabase: SupabaseClient): Promise<void> {
  // Store in a dedicated user preferences table or use project-level preferences
  // For now: store in Supabase user metadata via service role
  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? getSupabaseAdmin();
  await sb.auth.admin.updateUserById(userId, { user_metadata: { fallback_chain: chain } });
}

export async function getFallbackChain(userId: string, supabase: SupabaseClient): Promise<string[]> {
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  return (user?.user_metadata?.fallback_chain as string[]) ?? [];
}
