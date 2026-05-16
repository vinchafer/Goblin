import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../supabase';
import logger from '../logger';
import { captureError } from '../sentry';
import { pingHeartbeat } from '../heartbeat';
import { EVAL_PROVIDERS } from './providers';
import { scoreOutput } from './scorer';

interface EvalTask {
  id: string;
  category: string;
  title: string;
  prompt: string;
  expected_keywords: string[];
  max_tokens: number;
}

export interface EvalRunSummary {
  runId: string;
  resultCount: number;
  failed: number;
}

export async function runEvalSuite(): Promise<EvalRunSummary> {
  const runId = randomUUID();
  const sb = getSupabaseAdmin();

  const { data: tasks, error: taskErr } = await sb
    .from('eval_tasks')
    .select('*')
    .eq('enabled', true);

  if (taskErr || !tasks) {
    logger.error({ error: taskErr?.message }, 'eval runner — could not load tasks');
    captureError(new Error(`eval runner: ${taskErr?.message ?? 'no tasks'}`));
    return { runId, resultCount: 0, failed: 0 };
  }

  logger.info({ runId, taskCount: tasks.length, providers: EVAL_PROVIDERS.length }, 'eval suite starting');

  let resultCount = 0;
  let failed = 0;

  for (const task of tasks as EvalTask[]) {
    for (const provider of EVAL_PROVIDERS) {
      try {
        const result = await provider.call(task.prompt, task.max_tokens);
        const score = scoreOutput(result.output, task.expected_keywords);

        await sb.from('eval_results').insert({
          task_id: task.id,
          provider: provider.provider,
          model: provider.model,
          run_id: runId,
          prompt_tokens: result.tokens_in,
          completion_tokens: result.tokens_out,
          latency_ms: result.latency_ms,
          cost_usd: result.cost_usd,
          score: score.score,
          compiled: score.compiled,
          output_text: result.output.slice(0, 4000),
          error: result.error ?? null,
        });

        resultCount++;
        if (result.error) failed++;
      } catch (e) {
        logger.error({ taskId: task.id, provider: provider.provider, error: (e as Error).message }, 'eval task threw');
        captureError(e);
        failed++;
      }
    }
  }

  logger.info({ runId, resultCount, failed }, 'eval suite finished');

  if (failed === 0 && resultCount > 0) {
    await pingHeartbeat();
  }

  return { runId, resultCount, failed };
}
