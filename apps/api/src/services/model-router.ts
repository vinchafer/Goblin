import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { type SupabaseClient } from '@supabase/supabase-js';
import { decryptData } from './encryption';
import { getGoblinHostedConfig } from './goblin-hosted';

// ─── Types ────────────────────────────────────────────────────────

export type ModelLayer = 'byok' | 'free_api' | 'goblin_hosted';

export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'together'
  | 'google';

export interface RouteResult {
  layer: ModelLayer;
  provider: ProviderName;
  apiKey: string;
  baseURL: string;
  model: string;
}

// ─── Free-API Pool Config ─────────────────────────────────────────

interface FreePoolEntry {
  provider: ProviderName;
  envVar: string;
  baseURL: string;
  model: string;
}

const FREE_API_POOL: FreePoolEntry[] = [
  { provider: 'google',   envVar: 'GOOGLE_FREE_API_KEY',   baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.0-flash' },
  { provider: 'groq',     envVar: 'GROQ_FREE_API_KEY',     baseURL: 'https://api.groq.com/openai/v1',                        model: 'llama-3.3-70b-versatile' },
  { provider: 'openai',   envVar: 'CEREBRAS_FREE_API_KEY', baseURL: 'https://api.cerebras.ai/v1',                            model: 'llama-3.3-70b' },
  { provider: 'deepseek', envVar: 'OPENROUTER_FREE_API_KEY', baseURL: 'https://openrouter.ai/api/v1',                        model: 'deepseek-chat' },
];

// OpenAI-compatible providers (everything except anthropic)
export const OPENAI_COMPATIBLE: Record<string, { baseURL: string; defaultModel: string }> = {
  openai:    { baseURL: 'https://api.openai.com/v1',           defaultModel: 'gpt-4o' },
  groq:      { baseURL: 'https://api.groq.com/openai/v1',      defaultModel: 'llama-3.3-70b-versatile' },
  deepseek:  { baseURL: 'https://api.deepseek.com/v1',         defaultModel: 'deepseek-chat' },
  mistral:   { baseURL: 'https://api.mistral.ai/v1',           defaultModel: 'mistral-large-latest' },
  xai:       { baseURL: 'https://api.x.ai/v1',                 defaultModel: 'grok-2-1212' },
  together:  { baseURL: 'https://api.together.xyz/v1',         defaultModel: 'meta-llama/Llama-3-70b-chat-hf' },
  google:    { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.0-flash' },
};

// Priority for auto-selection when no model preference given
export const PROVIDER_PRIORITY: ProviderName[] = ['anthropic', 'openai', 'deepseek', 'groq', 'mistral', 'google', 'xai', 'together'];

// ─── Layer 3: BYOK ────────────────────────────────────────────────

async function resolveByokKey(
  userId: string,
  preferredProvider?: ProviderName,
  supabase?: SupabaseClient
): Promise<{ provider: ProviderName; apiKey: string } | null> {
  // We need supabase — create it if not provided
  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: keys } = await sb
    .from('byok_keys')
    .select('provider, key_encrypted')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!keys || keys.length === 0) return null;

  // If user has a preferred provider, try that first
  if (preferredProvider) {
    const match = keys.find(k => k.provider === preferredProvider);
    if (match) {
      return { provider: match.provider as ProviderName, apiKey: decryptData(match.key_encrypted) };
    }
  }

  // Otherwise use priority order
  for (const provider of PROVIDER_PRIORITY) {
    const match = keys.find(k => k.provider === provider);
    if (match) {
      return { provider, apiKey: decryptData(match.key_encrypted) };
    }
  }

  // Fallback: first available key
  const first = keys[0];
  if (!first) return null;
  return { provider: first.provider as ProviderName, apiKey: decryptData(first.key_encrypted) };
}

// ─── Layer 2: Free-API Pool ───────────────────────────────────────

function resolveFreeApi(): { provider: ProviderName; apiKey: string; baseURL: string; model: string } | null {
  for (const entry of FREE_API_POOL) {
    const key = process.env[entry.envVar];
    if (key && key.length > 0) {
      return {
        provider: entry.provider,
        apiKey: key,
        baseURL: entry.baseURL,
        model: entry.model,
      };
    }
  }
  return null;
}

// ─── Layer 1: Goblin Hosted (Phase 3) ─────────────────────────────

function resolveGoblinHosted(): { provider: ProviderName; apiKey: string; baseURL: string; model: string } | null {
  const config = getGoblinHostedConfig();
  if (!config) return null;
  return {
    provider: 'openai' as ProviderName,
    apiKey: config.apiKey,
    baseURL: config.endpoint,
    model: 'goblin-hosted-llama-3.3-70b',
  };
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Resolves the best available model route for a given user.
 *
 * Routing order:
 *  1. BYOK (Layer 3) — user's own keys from byok_keys table
 *  2. Free-API Pool (Layer 2) — company keys from env vars
 *  3. Goblin Hosted (Layer 1) — Phase 3, currently not active
 *
 * @throws {Error} If no route is available
 */
export async function resolveModel(
  userId: string,
  preferredModel?: string,
  supabase?: SupabaseClient
): Promise<RouteResult> {
  // Map preferredModel to provider if given (e.g. "claude-sonnet-4-6" → "anthropic")
  let preferredProvider: ProviderName | undefined;
  if (preferredModel) {
    const modelToProvider: Record<string, ProviderName> = {
      'claude-sonnet-4-6': 'anthropic',
      'claude-opus-4-6': 'anthropic',
      'claude-3-5-haiku-latest': 'anthropic',
      'claude-3-5-sonnet-latest': 'anthropic',
      'gpt-4o': 'openai',
      'gpt-4o-mini': 'openai',
      'gpt-4-turbo': 'openai',
      'llama-3.3-70b-versatile': 'groq',
      'llama-3.3-70b': 'openai',
      'deepseek-chat': 'deepseek',
      'deepseek-reasoner': 'deepseek',
      'gemini-2.0-flash': 'google',
      'mistral-large-latest': 'mistral',
      'grok-2-1212': 'xai',
      'meta-llama/Llama-3-70b-chat-hf': 'together',
    };
    preferredProvider = modelToProvider[preferredModel];
  }

  // Layer 3: BYOK
  const byokResult = await resolveByokKey(userId, preferredProvider, supabase);
  if (byokResult) {
    const config = OPENAI_COMPATIBLE[byokResult.provider] ?? 
      (byokResult.provider === 'anthropic' ? { baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-6' } : undefined);
    return {
      layer: 'byok',
      provider: byokResult.provider,
      apiKey: byokResult.apiKey,
      baseURL: byokResult.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : (config?.baseURL ?? ''),
      model: preferredModel ?? config?.defaultModel ?? 'claude-sonnet-4-6',
    };
  }

  // Layer 2: Free-API Pool
  const freeResult = resolveFreeApi();
  if (freeResult) {
    return {
      layer: 'free_api',
      provider: freeResult.provider,
      apiKey: freeResult.apiKey,
      baseURL: freeResult.baseURL,
      model: freeResult.model,
    };
  }

  // Layer 1: Goblin Hosted (Phase 3)
  const hostedResult = resolveGoblinHosted();
  if (hostedResult) {
    return {
      layer: 'goblin_hosted',
      provider: hostedResult.provider,
      apiKey: hostedResult.apiKey,
      baseURL: hostedResult.baseURL,
      model: hostedResult.model,
    };
  }

  // No route available
  throw new Error('No LLM route available. Add a BYOK key in Settings → API Keys, or configure Free-API Pool keys in .env.');
}

// ─── Streaming ────────────────────────────────────────────────────

interface StreamCompletionParams {
  userId: string;
  projectId: string;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
  modelPreference?: string;
  supabase?: SupabaseClient;
}

export async function* streamCompletion({
  userId,
  projectId,
  message,
  chatHistory,
  modelPreference,
  supabase,
}: StreamCompletionParams): AsyncGenerator<string, void, unknown> {
  const route = await resolveModel(userId, modelPreference, supabase);

  const messages = [
    ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  let inputTokens = 0;
  let outputTokens = 0;

  // Send route metadata as first yield
  yield JSON.stringify({
    type: 'meta',
    source_tier: route.layer,
    model: route.model,
    provider: route.provider,
  });

  // Use the supabase if provided, otherwise create one for logging
  const { createClient } = await import('@supabase/supabase-js');
  const sb = supabase ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: agentRun } = await sb
    .from('agent_runs')
    .insert({
      user_id: userId,
      project_id: projectId,
      model_used: route.model,
      source_tier: route.layer,
      status: 'running',
    })
    .select()
    .single();

  try {
    if (route.provider === 'anthropic') {
      // Anthropic uses its own SDK
      const anthropic = new Anthropic({ apiKey: route.apiKey });
      const model = modelPreference ?? 'claude-sonnet-4-6';

      const stream = await anthropic.messages.create({
        model,
        max_tokens: 8096,
        messages,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          outputTokens++;
          yield JSON.stringify({ type: 'delta', content: event.delta.text });
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        }
      }
    } else {
      // OpenAI-compatible providers
      const config = OPENAI_COMPATIBLE[route.provider];
      if (!config) throw new Error(`Unsupported provider: ${route.provider}`);

      const openai = new OpenAI({ apiKey: route.apiKey, baseURL: route.baseURL });
      const model = modelPreference ?? config.defaultModel;

      const stream = await openai.chat.completions.create({
        model,
        max_tokens: 8096,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          outputTokens++;
          yield JSON.stringify({ type: 'delta', content: text });
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
        }
      }
    }

    // Update agent run as success
    if (agentRun) {
      await sb
        .from('agent_runs')
        .update({ status: 'success', input_tokens: inputTokens, output_tokens: outputTokens, completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);
    }

    // Signal completion
    yield JSON.stringify({ type: 'done' });
  } catch (err: unknown) {
    if (agentRun) {
      await sb
        .from('agent_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);
    }
    throw err;
  }
}