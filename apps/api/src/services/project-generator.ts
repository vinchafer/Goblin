import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { PROJECT_GENERATOR_SYSTEM_PROMPT } from '../prompts/project-generator';
import { getActiveKey } from './byok-service';
import { saveFile } from './file-storage';
import type { SSEStreamingApi } from 'hono/streaming';

interface GenerationResult {
  projectType: string;
  description: string;
  setupInstructions: string;
  files: Array<{ path: string; content: string }>;
}

export async function generateProject(
  userId: string,
  projectId: string,
  prompt: string,
  byokKeyId: string,
  stream: SSEStreamingApi
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
      model_used: 'claude-3-5-sonnet-20240620',
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

    // Get user key
    const apiKey = await getActiveKey(userId, 'anthropic');
    if (!apiKey) {
      throw new Error('No active Anthropic key found');
    }

    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = PROJECT_GENERATOR_SYSTEM_PROMPT.replace('{{PROMPT}}', prompt);

    await stream.writeSSE({
      data: JSON.stringify({ type: 'planning', message: 'Generating project structure...' })
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      system: systemPrompt
    });

    // Parse response
    const firstContent = response.content[0];
    const content = firstContent?.type === 'text' ? firstContent.text : '';
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);

    if (!jsonMatch) {
      throw new Error('Failed to parse generation response');
    }

    const result: GenerationResult = JSON.parse(jsonMatch[1] ?? '{}');

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
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
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