import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

const rankings = new Hono();

// GET /api/rankings?task=coding&limit=20
rankings.get('/', async (c) => {
  const taskType = c.req.query('task') ?? 'general';
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('model_composite_rankings')
    .select(
      `
      rank,
      composite_score,
      source_count,
      contributing_sources,
      computed_at,
      ranked_models (
        id,
        provider,
        display_name,
        family,
        context_tokens,
        pricing_in_per_million,
        pricing_out_per_million,
        is_open_source,
        released_at
      )
    `,
    )
    .eq('task_type', taskType)
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'rankings query failed');
    return c.json({ error: 'query_failed' }, 500);
  }

  return c.json({ task_type: taskType, limit, rankings: data ?? [] });
});

// GET /api/rankings/models — flat list of all known models
rankings.get('/models', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ranked_models')
    .select(
      'id, provider, display_name, family, context_tokens, pricing_in_per_million, pricing_out_per_million, is_open_source, released_at, last_seen_at',
    )
    .order('last_seen_at', { ascending: false });

  if (error) return c.json({ error: 'query_failed' }, 500);
  return c.json({ models: data ?? [] });
});

// GET /api/rankings/models/:id — single model detail
rankings.get('/models/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { data: model, error: modelErr } = await supabase
    .from('ranked_models')
    .select('*')
    .eq('id', id)
    .single();

  if (modelErr || !model) return c.json({ error: 'not_found' }, 404);

  const { data: perSource } = await supabase
    .from('model_rankings')
    .select('source_id, dimension, normalized_score, raw_score, rank_in_source, fetched_at')
    .eq('model_id', id);

  const { data: composites } = await supabase
    .from('model_composite_rankings')
    .select('task_type, composite_score, rank, source_count')
    .eq('model_id', id);

  const { data: history } = await supabase
    .from('model_ranking_history')
    .select('source_id, dimension, normalized_score, rank_in_source, run_at')
    .eq('model_id', id)
    .order('run_at', { ascending: false })
    .limit(200);

  return c.json({
    model,
    per_source_rankings: perSource ?? [],
    composite_rankings: composites ?? [],
    history: history ?? [],
  });
});

// GET /api/rankings/sources — public source status
rankings.get('/sources', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('model_sources')
    .select('id, name, url, description, enabled, last_fetched_at, last_status, last_record_count')
    .order('id', { ascending: true });
  if (error) return c.json({ error: 'query_failed' }, 500);
  return c.json({ sources: data ?? [] });
});

export { rankings };
