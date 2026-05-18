import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SourceAdapter,
  AdapterResult,
  Dimension,
  TaskType,
  RawAdapterEntry,
} from './types';
import { openRouterAdapter } from './adapters/openrouter';
import { aiderAdapter } from './adapters/aider';
import { liveBenchAdapter } from './adapters/livebench';
import { huggingFaceAdapter } from './adapters/huggingface';
import { sweBenchAdapter } from './adapters/swebench';
import { normalizeScores } from './normalize';
import { extractFamily } from './canonicalize';
import logger from '../logger';
import { pingHeartbeat } from '../heartbeat';
import { Sentry } from '../sentry';
import { getSupabaseAdmin } from '../supabase';

const ADAPTERS: SourceAdapter[] = [
  openRouterAdapter,
  aiderAdapter,
  liveBenchAdapter,
  huggingFaceAdapter,
  sweBenchAdapter,
];

const TASK_WEIGHTS: Record<TaskType, Partial<Record<Dimension, number>>> = {
  coding: {
    coding: 0.7,
    reasoning: 0.15,
    'instruction-following': 0.1,
    'cost-efficiency': 0.05,
  },
  reasoning: {
    reasoning: 0.6,
    overall: 0.2,
    math: 0.15,
    'instruction-following': 0.05,
  },
  speed: {
    'cost-efficiency': 0.4,
    coding: 0.3,
    overall: 0.3,
  },
  'cost-efficiency': {
    'cost-efficiency': 0.7,
    overall: 0.2,
    coding: 0.1,
  },
  general: {
    overall: 0.4,
    coding: 0.2,
    reasoning: 0.2,
    'instruction-following': 0.1,
    'cost-efficiency': 0.1,
  },
};

const TASK_TYPES: TaskType[] = ['coding', 'reasoning', 'speed', 'cost-efficiency', 'general'];

export async function runRankingsAggregator(): Promise<{
  runId: string;
  sources: number;
  modelsAdded: number;
  rankingsWritten: number;
  failed: string[];
}> {
  const runId = randomUUID();
  const supabase = getSupabaseAdmin();

  logger.info({ runId, adapterCount: ADAPTERS.length }, 'rankings aggregator starting');

  const results: AdapterResult[] = await Promise.all(ADAPTERS.map((a) => a.fetch()));
  const failed: string[] = [];

  for (const r of results) {
    if (r.error) {
      failed.push(`${r.sourceId}: ${r.error}`);
      logger.warn({ source: r.sourceId, error: r.error }, 'adapter returned error');
      Sentry.captureMessage(`rankings adapter failed: ${r.sourceId} — ${r.error}`, 'warning');
    }
    await supabase
      .from('model_sources')
      .update({
        last_fetched_at: r.fetchedAt,
        last_status: r.error ? 'fail' : 'ok',
        last_error: r.error ?? null,
        last_record_count: r.entries.length,
      })
      .eq('id', r.sourceId);
  }

  // Merge canonical models across all sources
  const modelMap = new Map<
    string,
    { provider: string; displayName: string; meta: NonNullable<RawAdapterEntry['meta']> }
  >();
  for (const r of results) {
    for (const e of r.entries) {
      const existing = modelMap.get(e.modelId);
      if (!existing) {
        modelMap.set(e.modelId, {
          provider: e.provider,
          displayName: e.displayName,
          meta: { ...(e.meta ?? {}) },
        });
      } else {
        if (e.meta?.contextTokens && !existing.meta.contextTokens)
          existing.meta.contextTokens = e.meta.contextTokens;
        if (e.meta?.pricingInPerMillion && !existing.meta.pricingInPerMillion)
          existing.meta.pricingInPerMillion = e.meta.pricingInPerMillion;
        if (e.meta?.pricingOutPerMillion && !existing.meta.pricingOutPerMillion)
          existing.meta.pricingOutPerMillion = e.meta.pricingOutPerMillion;
        if (e.meta?.isOpenSource) existing.meta.isOpenSource = true;
      }
    }
  }

  let modelsAdded = 0;
  for (const [modelId, meta] of modelMap.entries()) {
    const { error } = await supabase.from('ranked_models').upsert(
      {
        id: modelId,
        provider: meta.provider,
        display_name: meta.displayName,
        family: extractFamily(modelId),
        context_tokens: meta.meta.contextTokens ?? null,
        pricing_in_per_million: meta.meta.pricingInPerMillion ?? null,
        pricing_out_per_million: meta.meta.pricingOutPerMillion ?? null,
        is_open_source: meta.meta.isOpenSource ?? false,
        released_at: meta.meta.releasedAt ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (!error) modelsAdded++;
    else logger.warn({ modelId, error: error.message }, 'model upsert failed');
  }

  let rankingsWritten = 0;
  for (const r of results) {
    if (r.error) continue;

    const dimensionsInSource = new Set<Dimension>();
    for (const e of r.entries) {
      for (const dim of Object.keys(e.scores) as Dimension[]) {
        if (e.scores[dim] != null) dimensionsInSource.add(dim);
      }
    }

    for (const dim of dimensionsInSource) {
      const scoresForDim = r.entries
        .filter((e) => e.scores[dim] != null)
        .map((e) => ({ key: e.modelId, value: e.scores[dim] as number }));

      const normalized = normalizeScores(scoresForDim);
      const ranked = [...normalized.entries()].sort((a, b) => b[1] - a[1]);
      const rankMap = new Map(ranked.map(([modelId], i) => [modelId, i + 1]));

      for (const e of r.entries) {
        const raw = e.scores[dim];
        if (raw == null) continue;
        const norm = normalized.get(e.modelId);
        if (norm == null) continue;
        const rank = rankMap.get(e.modelId);

        await supabase.from('model_rankings').upsert(
          {
            model_id: e.modelId,
            source_id: r.sourceId,
            dimension: dim,
            raw_score: raw,
            normalized_score: norm,
            rank_in_source: rank,
            fetched_at: r.fetchedAt,
          },
          { onConflict: 'model_id,source_id,dimension' },
        );

        await supabase.from('model_ranking_history').insert({
          run_id: runId,
          model_id: e.modelId,
          source_id: r.sourceId,
          dimension: dim,
          normalized_score: norm,
          rank_in_source: rank,
          run_at: r.fetchedAt,
        });

        rankingsWritten++;
      }
    }
  }

  await computeCompositeRankings(supabase);

  logger.info(
    { runId, modelsAdded, rankingsWritten, failed: failed.length },
    'rankings aggregator finished',
  );

  if (failed.length < ADAPTERS.length) {
    await pingHeartbeat();
  }

  return { runId, sources: ADAPTERS.length, modelsAdded, rankingsWritten, failed };
}

async function computeCompositeRankings(supabase: SupabaseClient): Promise<void> {
  const { data: rankings, error } = await supabase
    .from('model_rankings')
    .select('model_id, source_id, dimension, normalized_score');

  if (error || !rankings) {
    logger.error({ error: error?.message }, 'composite — failed to load rankings');
    return;
  }

  const modelDimScores = new Map<string, Map<Dimension, number[]>>();
  const modelDimSources = new Map<string, Map<Dimension, Set<string>>>();
  for (const r of rankings as Array<{
    model_id: string;
    source_id: string;
    dimension: string;
    normalized_score: number | null;
  }>) {
    if (r.normalized_score == null) continue;
    const dim = r.dimension as Dimension;

    if (!modelDimScores.has(r.model_id)) modelDimScores.set(r.model_id, new Map());
    const dimMap = modelDimScores.get(r.model_id)!;
    if (!dimMap.has(dim)) dimMap.set(dim, []);
    dimMap.get(dim)!.push(Number(r.normalized_score));

    if (!modelDimSources.has(r.model_id)) modelDimSources.set(r.model_id, new Map());
    const srcMap = modelDimSources.get(r.model_id)!;
    if (!srcMap.has(dim)) srcMap.set(dim, new Set());
    srcMap.get(dim)!.add(r.source_id);
  }

  const modelDimAvg = new Map<string, Map<Dimension, number>>();
  for (const [modelId, dimMap] of modelDimScores.entries()) {
    const avgMap = new Map<Dimension, number>();
    for (const [dim, scores] of dimMap.entries()) {
      avgMap.set(dim, scores.reduce((s, x) => s + x, 0) / scores.length);
    }
    modelDimAvg.set(modelId, avgMap);
  }

  for (const taskType of TASK_TYPES) {
    const weights = TASK_WEIGHTS[taskType];
    const composites: Array<{ modelId: string; score: number; sources: Set<string> }> = [];

    for (const [modelId, dimAvg] of modelDimAvg.entries()) {
      let weightedSum = 0;
      let weightUsed = 0;
      const sourceSet = new Set<string>();
      const dimSources = modelDimSources.get(modelId);

      for (const [dim, weight] of Object.entries(weights) as Array<[Dimension, number]>) {
        const avg = dimAvg.get(dim);
        if (avg != null) {
          weightedSum += avg * weight;
          weightUsed += weight;
          const srcs = dimSources?.get(dim);
          if (srcs) for (const s of srcs) sourceSet.add(s);
        }
      }

      if (weightUsed > 0) {
        composites.push({
          modelId,
          score: weightedSum / weightUsed,
          sources: sourceSet,
        });
      }
    }

    composites.sort((a, b) => b.score - a.score);

    await supabase.from('model_composite_rankings').delete().eq('task_type', taskType);

    let rank = 0;
    for (const c of composites) {
      rank++;
      await supabase.from('model_composite_rankings').insert({
        model_id: c.modelId,
        task_type: taskType,
        composite_score: Number(c.score.toFixed(4)),
        rank,
        source_count: c.sources.size,
        contributing_sources: Array.from(c.sources),
      });
    }

    logger.info({ taskType, modelCount: composites.length }, 'composite computed');
  }
}
