import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { saveFallbackChain, getFallbackChain } from '../services/model-router';

type Variables = { userId: string };
const users = new Hono<{ Variables: Variables }>();

users.use('*', authMiddleware);

// GET /api/users/me/fallback-chain
users.get('/me/fallback-chain', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const chain = await getFallbackChain(userId, supabase).catch(() => []);
  return c.json({ chain });
});

// PUT /api/users/me/fallback-chain
users.put('/me/fallback-chain', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const schema = z.object({ chain: z.array(z.string()).max(20) });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid chain' }, 400);
  const supabase = getSupabaseAdmin();
  await saveFallbackChain(userId, result.data.chain, supabase);
  return c.json({ success: true, chain: result.data.chain });
});

// GET /api/users/me/usage?period=30d
users.get('/me/usage', async (c) => {
  const userId = c.get('userId');
  const period = c.req.query('period') ?? '30d';
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Fetch user plan info
  const { data: userRow } = await supabase
    .from('users')
    .select('plan, monthly_requests_used, monthly_limit, billing_cycle_start')
    .eq('id', userId)
    .single();

  // Fetch agent_runs for period
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('source_tier, model_used, project_id, created_at, status')
    .eq('user_id', userId)
    .gte('created_at', since)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(2000);

  const allRuns = runs ?? [];

  // By tier
  const tierMap: Record<string, number> = { byok: 0, free_api: 0, goblin_hosted: 0 };
  for (const r of allRuns) {
    const t = (r.source_tier as string) ?? 'byok';
    if (t in tierMap) tierMap[t]++;
  }

  // By model (top 5)
  const modelMap: Record<string, number> = {};
  for (const r of allRuns) {
    const m = (r.model_used as string) ?? 'unknown';
    modelMap[m] = (modelMap[m] ?? 0) + 1;
  }
  const byModel = Object.entries(modelMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([model, count]) => ({ model, count }));

  // By project (top 5)
  const projectMap: Record<string, number> = {};
  for (const r of allRuns) {
    if (!r.project_id) continue;
    const p = r.project_id as string;
    projectMap[p] = (projectMap[p] ?? 0) + 1;
  }
  const byProjectIds = Object.entries(projectMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Resolve project names
  let byProject: Array<{ projectId: string; name: string; count: number }> = [];
  if (byProjectIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', byProjectIds.map(([id]) => id));
    const nameMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.name as string]));
    byProject = byProjectIds.map(([id, count]) => ({ projectId: id, name: nameMap[id] ?? 'Unknown', count }));
  }

  // Days until billing reset
  let daysUntilReset: number | null = null;
  if (userRow?.billing_cycle_start) {
    const cycleStart = new Date(userRow.billing_cycle_start as string);
    const nextReset = new Date(cycleStart);
    nextReset.setMonth(nextReset.getMonth() + 1);
    daysUntilReset = Math.max(0, Math.ceil((nextReset.getTime() - Date.now()) / 86400000));
  }

  return c.json({
    plan: (userRow?.plan as string) ?? 'free',
    monthlyUsed: (userRow?.monthly_requests_used as number) ?? 0,
    monthlyLimit: (userRow?.monthly_limit as number) ?? 0,
    daysUntilReset,
    period,
    totalInPeriod: allRuns.length,
    byTier: tierMap,
    byModel,
    byProject,
  });
});

export { users };
