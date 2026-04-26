import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '../lib/supabase';
import { decryptData } from './encryption';

interface StreamCompletionParams {
  userId: string;
  projectId: string;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
  modelPreference?: string;
}

// Provider configs for OpenAI-compatible APIs
const OPENAI_COMPATIBLE: Record<string, { baseURL: string; defaultModel: string }> = {
  openai:    { baseURL: 'https://api.openai.com/v1',           defaultModel: 'gpt-4o' },
  groq:      { baseURL: 'https://api.groq.com/openai/v1',      defaultModel: 'llama-3.3-70b-versatile' },
  deepseek:  { baseURL: 'https://api.deepseek.com/v1',         defaultModel: 'deepseek-chat' },
  mistral:   { baseURL: 'https://api.mistral.ai/v1',           defaultModel: 'mistral-large-latest' },
  xai:       { baseURL: 'https://api.x.ai/v1',                 defaultModel: 'grok-2-1212' },
  together:  { baseURL: 'https://api.together.xyz/v1',         defaultModel: 'meta-llama/Llama-3-70b-chat-hf' },
  google:    { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.0-flash' },
};

// Provider priority order for auto-selection
const PROVIDER_PRIORITY = ['anthropic', 'openai', 'deepseek', 'groq', 'mistral', 'google', 'xai', 'together'];

async function getFirstActiveKey(userId: string): Promise<{ provider: string; key: string } | null> {
  const supabase = getSupabaseAdmin();

  const { data: keys } = await supabase
    .from('byok_keys')
    .select('provider, key_encrypted')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!keys || keys.length === 0) return null;

  for (const provider of PROVIDER_PRIORITY) {
    const match = keys.find(k => k.provider === provider);
    if (match) {
      return { provider, key: decryptData(match.key_encrypted) };
    }
  }

  // Fallback: use whatever key exists first
  const first = keys[0];
  if (!first) return null;
  return { provider: first.provider, key: decryptData(first.key_encrypted) };
}

export async function* streamCompletion({
  userId,
  projectId,
  message,
  chatHistory,
  modelPreference
}: StreamCompletionParams): AsyncGenerator<string, void, unknown> {
  const supabase = getSupabaseAdmin();

  const keyInfo = await getFirstActiveKey(userId);
  if (!keyInfo) {
    throw new Error('No BYOK key configured. Add an API key in Settings → API Keys.');
  }

  const { provider, key } = keyInfo;

  const { data: agentRun } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      project_id: projectId,
      model_used: modelPreference ?? provider,
      source_tier: 'byok',
      status: 'running'
    })
    .select()
    .single();

  const messages = [
    ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message }
  ];

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: key });
      const model = modelPreference ?? 'claude-sonnet-4-6';

      const stream = anthropic.messages.stream({
        model,
        max_tokens: 8096,
        messages
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          outputTokens++;
          yield event.delta.text;
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        }
      }
    } else {
      const config = OPENAI_COMPATIBLE[provider];
      if (!config) throw new Error(`Unsupported provider: ${provider}`);

      const openai = new OpenAI({ apiKey: key, baseURL: config.baseURL });
      const model = modelPreference ?? config.defaultModel;

      const stream = await openai.chat.completions.create({
        model,
        max_tokens: 8096,
        messages,
        stream: true
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          outputTokens++;
          yield text;
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
        }
      }
    }

    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({ status: 'success', input_tokens: inputTokens, output_tokens: outputTokens, completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);
    }
  } catch (err) {
    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);
    }
    throw err;
  }
}
