import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '../lib/supabase';
import { PROJECT_GENERATOR_SYSTEM_PROMPT } from '../prompts/project-generator';
import { getActiveKey } from './byok-service';
import { decryptData } from './encryption';
import { saveFile } from './file-storage';
import { reconcileBlockPaths } from '../lib/asset-reconcile';
import { OPENAI_COMPATIBLE, PROVIDER_PRIORITY } from './model-router';
import type { SSEStreamingApi } from 'hono/streaming';

interface GenerationResult {
  projectType: string;
  description: string;
  setupInstructions: string;
  files: Array<{ path: string; content: string }>;
}

async function getKeyById(userId: string, keyId: string): Promise<{ provider: string; key: string } | null> {
  const supabase = getSupabaseAdmin();

  const { data: row } = await supabase
    .from('byok_keys')
    .select('provider, key_encrypted')
    .eq('id', keyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!row) return null;
  return { provider: row.provider, key: decryptData(row.key_encrypted) };
}

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

  const first = keys[0];
  if (!first) return null;
  return { provider: first.provider, key: decryptData(first.key_encrypted) };
}

export async function generateProject(
  userId: string,
  projectId: string,
  prompt: string,
  byokKeyId: string,
  stream: SSEStreamingApi
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Update project status
  await supabase
    .from('projects')
    .update({ status: 'generating' })
    .eq('id', projectId);

  // Create agent run record
  const { data: agentRun } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      project_id: projectId,
      model_used: 'claude-sonnet-4-6',
      source_tier: 'byok',
      run_type: 'project_generation',
      status: 'running'
    })
    .select()
    .single();

  try {
    await stream.writeSSE({
      data: JSON.stringify({ type: 'planning', message: 'Analyzing request...' })
    });

    const keyInfo = byokKeyId
      ? await getKeyById(userId, byokKeyId)
      : await getFirstActiveKey(userId);
    if (!keyInfo) {
      throw new Error('NO_KEY: Add an API key in Settings → API Keys to generate projects.');
    }

    const { provider, key } = keyInfo;

    await stream.writeSSE({
      data: JSON.stringify({ type: 'planning', message: `Generating project structure (${provider})...` })
    });

    const systemPrompt = PROJECT_GENERATOR_SYSTEM_PROMPT.replace('{{PROMPT}}', prompt);

    let responseText = '';

    if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: key });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt
      });

      const firstContent = response.content[0];
      responseText = firstContent?.type === 'text' ? firstContent.text : '';
    } else {
      const config = OPENAI_COMPATIBLE[provider];
      if (!config) throw new Error(`Unsupported provider: ${provider}`);

      const openai = new OpenAI({ apiKey: key, baseURL: config.baseURL });

      const response = await openai.chat.completions.create({
        model: config.defaultModel,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      });

      responseText = response.choices[0]?.message?.content || '';
    }

    // Parse response
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);

    if (!jsonMatch) {
      throw new Error('Failed to parse generation response');
    }

    const result: GenerationResult = JSON.parse(jsonMatch[1] ?? '{}');

    // WALK2-1: prevent the orphan at the source. The model sometimes names the
    // stylesheet file differently from the `<link href>` it writes into the HTML
    // (e.g. file `styles.css` but `<link href="style.css">`) — which 404s the
    // stylesheet and ships an unstyled page. Align each css/js file path to the
    // asset its HTML actually links before saving.
    if (Array.isArray(result.files)) {
      reconcileBlockPaths(result.files, result.files);
    }

    // Save all files
    for (let i = 0; i < result.files.length; i++) {
      const file = result.files[i]!;
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'generating_file',
          path: file.path,
          progress: Math.round(((i + 1) / result.files.length) * 100)
        })
      });

      await saveFile(projectId, file.path, file.content);
    }

    // Update project status
    await supabase
      .from('projects')
      .update({
        status: 'ready',
        last_generated: new Date().toISOString()
      })
      .eq('id', projectId);

    // Update agent run
    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'success',
          model_used: provider,
          completed_at: new Date().toISOString()
        })
        .eq('id', agentRun.id);
    }

    await stream.writeSSE({
      data: JSON.stringify({
        type: 'complete',
        fileCount: result.files.length,
        setupInstructions: result.setupInstructions
      })
    });

  } catch (err: unknown) {
    await supabase
      .from('projects')
      .update({ status: 'generation_failed' })
      .eq('id', projectId);

    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        .eq('id', agentRun.id);
    }

    await stream.writeSSE({
      data: JSON.stringify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Generation failed'
      })
    });

    throw err;
  }
}