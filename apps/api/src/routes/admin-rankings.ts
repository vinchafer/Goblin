import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import { runRankingsAggregator } from '../lib/rankings/aggregator';

const adminRankings = new Hono();

adminRankings.use('*', async (c, next) => {
  const adminKey = c.req.header('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || !adminKey || adminKey !== expectedKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

adminRankings.get('/sources', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('model_sources')
    .select('*')
    .order('id', { ascending: true });
  if (error) return c.json({ error: 'query_failed' }, 500);
  return c.json({ sources: data ?? [] });
});

adminRankings.post('/refresh', async (c) => {
  const result = await runRankingsAggregator();
  return c.json(result);
});

export { adminRankings };
