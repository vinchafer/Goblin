import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { saveFallbackChain, getFallbackChain } from '../services/model-router';
import { extendTrial } from '../middleware/trial-gate';

type Variables = { userId: string };
const users = new Hono<{ Variables: Variables }>();

users.use('*', authMiddleware);

// PATCH /api/users/me — update default model preferences + advanced_mode
users.patch('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const schema = z.object({
    default_chat_model: z.string().nullable().optional(),
    default_code_model: z.string().nullable().optional(),
    advanced_mode: z.boolean().optional(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid body' }, 400);

  const update: Record<string, unknown> = {};
  if ('default_chat_model' in result.data) update.default_chat_model = result.data.default_chat_model;
  if ('default_code_model' in result.data) update.default_code_model = result.data.default_code_model;
  if ('advanced_mode' in result.data) update.advanced_mode = result.data.advanced_mode;

  if (Object.keys(update).length === 0) return c.json({ success: true });

  const supabase = getSupabaseAdmin();
  await supabase.from('users').update(update).eq('id', userId).throwOnError();
  return c.json({ success: true });
});

// GET /api/users/me — get user prefs
users.get('/me', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('default_chat_model, default_code_model, plan, advanced_mode, is_comped')
    .eq('id', userId)
    .single();
  if (!data) return c.json({ error: 'User not found' }, 404);

  // Pull display name from auth metadata (best-effort)
  let displayName: string | null = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const meta = authUser.user?.user_metadata as Record<string, unknown> | undefined;
    displayName = (meta?.display_name as string) ?? (meta?.full_name as string) ?? (meta?.name as string) ?? null;
    if (!displayName && authUser.user?.email) {
      displayName = authUser.user.email.split('@')[0] ?? null;
    }
  } catch { /* silent */ }

  return c.json({ ...data, displayName });
});

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
    if (t in tierMap) tierMap[t] = (tierMap[t] ?? 0) + 1;
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

// GET /api/users/me/trial — trial status
users.get('/me/trial', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id, cloud_trial_started_at, cloud_trial_ends_at, trial_extension_used, is_comped')
    .eq('id', userId)
    .single();

  if (!user) return c.json({ trialStatus: 'none' });

  // Comped users have full access — no trial banner ever.
  if (user.is_comped) return c.json({ trialStatus: 'subscribed' });

  const hasActiveSub = !!user.stripe_subscription_id;
  if (hasActiveSub) return c.json({ trialStatus: 'subscribed' });

  if (!user.cloud_trial_started_at) return c.json({ trialStatus: 'not_started' });

  const trialEnd = new Date(user.cloud_trial_ends_at as string);
  const now = new Date();
  const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);

  return c.json({
    trialStatus: now <= trialEnd ? 'active' : 'expired',
    trialEndsAt: user.cloud_trial_ends_at,
    daysLeft: Math.max(0, daysLeft),
    extensionUsed: user.trial_extension_used ?? false,
  });
});

// POST /api/users/me/trial/extend
users.post('/me/trial/extend', async (c) => {
  const userId = c.get('userId');
  const result = await extendTrial(userId);
  if (!result.success) {
    return c.json({ error: 'Extension already used or trial not active' }, 400);
  }
  return c.json({ success: true, newEnd: result.newEnd });
});

export { users };
