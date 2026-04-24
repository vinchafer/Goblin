import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { decryptKey } from './encryption';

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

  const apiKey = await decryptKey(byokKey.key_encrypted);
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
    messages: [...chatHistory, { role: 'user', content: message }]
  });

  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
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