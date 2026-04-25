import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '../lib/supabase';
import { decryptData } from './encryption';

interface StreamCompletionParams {
  userId: string;
  projectId: string;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
  modelPreference?: string;
}

export async function* streamCompletion({
  userId,
  projectId,
  message,
  chatHistory,
  modelPreference
}: StreamCompletionParams): AsyncGenerator<string, void, unknown> {
  const supabase = getSupabaseAdmin();

  const { data: byokKey } = await supabase
    .from('byok_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'anthropic')
    .eq('status', 'active')
    .single();

  if (!byokKey) {
    throw new Error('Add your Anthropic key to chat');
  }

  const apiKey = decryptData(byokKey.key_encrypted);
  const anthropic = new Anthropic({ apiKey });

  const { data: agentRun } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      project_id: projectId,
      model_used: 'claude-3-5-sonnet-20240620',
      source_tier: 'byok',
      status: 'running'
    })
    .select()
    .single();

  const stream = anthropic.messages.stream({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 4096,
    messages: [
      ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message }
    ]
  });

  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const token = event.delta.text;
      fullResponse += token;
      outputTokens++;
      yield token;
    } else if (event.type === 'message_start') {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  await supabase
    .from('agent_runs')
    .update({
      status: 'success',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      completed_at: new Date().toISOString()
    })
    .eq('id', agentRun.id);

  return;
}