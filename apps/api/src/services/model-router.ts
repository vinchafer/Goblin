import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { type SupabaseClient } from '@supabase/supabase-js';
import { decryptData } from './encryption';
import { getGoblinHostedConfig } from './goblin-hosted';
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
}

// ─── Free-API Pool ────────────────────────────────────────────────────────────

interface FreePoolEntry {
  provider: ProviderName;
  envVar: string;
  baseURL: string;
  model: string;
  slug: string;
}

const FREE_API_POOL: FreePoolEntry[] = [
  { provider: 'google',   envVar: 'GOOGLE_FREE_API_KEY',     baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.0-flash',        slug: 'free/gemini-flash' },
  { provider: 'groq',     envVar: 'GROQ_FREE_API_KEY',       baseURL: 'https://api.groq.com/openai/v1',                          model: 'llama-3.3-70b-versatile', slug: 'free/llama-70b' },
  { provider: 'openai',   envVar: 'CEREBRAS_FREE_API_KEY',   baseURL: 'https://api.cerebras.ai/v1',                              model: 'llama-3.3-70b',           slug: 'free/llama-70b' },
  { provider: 'deepseek', envVar: 'OPENROUTER_FREE_API_KEY', baseURL: 'https://openrouter.ai/api/v1',                            model: 'deepseek/deepseek-chat',  slug: 'free/deepseek' },
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
  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: keys } = await sb
    .from('byok_keys')
    .select('provider, key_encrypted')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!keys || keys.length === 0) return null;

  if (preferredProvider) {
    const match = keys.find(k => k.provider === preferredProvider);
    if (match) return { provider: match.provider as ProviderName, apiKey: decryptData(match.key_encrypted) };
  }

  for (const provider of PROVIDER_PRIORITY) {
    const match = keys.find(k => k.provider === provider);
    if (match) return { provider, apiKey: decryptData(match.key_encrypted) };
  }

  const first = keys[0];
  if (!first) return null;
  return { provider: first.provider as ProviderName, apiKey: decryptData(first.key_encrypted) };
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
    return {
      layer: 'byok',
      provider: byok.provider,
      apiKey: byok.apiKey,
      baseURL,
      model: resolvedModel,
      modelSlug: preferredModel ?? `${byok.provider}/${resolvedModel}`,
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
    };
  }

  throw new GoblinError('unknown', 'No model available. Add an API key in Settings → API Keys, or configure Free-API Pool keys in .env.');
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
}

export async function* streamCompletion({
  userId,
  projectId,
  message,
  chatHistory,
  modelPreference,
  supabase,
  timeoutMs = 120_000,
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
  const sb = supabase ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: agentRun } = await sb
    .from('agent_runs')
    .insert({ user_id: userId, project_id: projectId, model_used: route.model, source_tier: route.layer, status: 'running' })
    .select().single();

  // Try LiteLLM first if configured
  const litellmBase = process.env.LITELLM_BASE_URL;
  if (litellmBase) {
    try {
      for await (const delta of litellmStream(route.modelSlug, messages, { apiKey: route.apiKey, timeout: timeoutMs })) {
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
  const sb = supabase ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await sb.auth.admin.updateUserById(userId, { user_metadata: { fallback_chain: chain } });
}

export async function getFallbackChain(userId: string, supabase: SupabaseClient): Promise<string[]> {
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  return (user?.user_metadata?.fallback_chain as string[]) ?? [];
}
