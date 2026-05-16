import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const admin = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────

admin.use('*', async (c, next) => {
  const adminKey = c.req.header('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || !adminKey || adminKey !== expectedKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});

// ─── Users ────────────────────────────────────────────────────────────────────

admin.get('/users', async (c) => {
  const supabase = getSupabaseAdmin();
  const page  = Math.max(1, parseInt(c.req.query('page')  ?? '1', 10));
  const limit = Math.max(1, parseInt(c.req.query('limit') ?? '20', 10));
  const search = c.req.query('search') ?? '';
  const offset = (page - 1) * limit;

  let query = supabase
    .from('users')
    .select(
      'id, email, plan, monthly_requests_used, monthly_limit, created_at, ' +
      'stripe_customer_id, stripe_subscription_id, subscription_current_period_end, ' +
      'is_admin, is_suspended, deleted_at',
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('email', `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    data: data ?? [],
    page,
    limit,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
});

admin.get('/users/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select(
      'id, email, plan, monthly_requests_used, monthly_limit, created_at, ' +
      'stripe_customer_id, stripe_subscription_id, subscription_current_period_end, ' +
      'is_admin, is_suspended, deleted_at'
    )
    .eq('id', id)
    .single();

  if (userError) return c.json({ error: userError.message }, 404);

  const { data: builds } = await supabase
    .from('build_runs')
    .select('id, project_id, type, status, progress_pct, message, created_at, completed_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return c.json({ user, recent_builds: builds ?? [] });
});

admin.patch('/users/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();
  const body = await c.req.json<{
    plan?: string;
    is_suspended?: boolean;
    is_admin?: boolean;
  }>();

  const allowed: Record<string, unknown> = {};
  if (body.plan        !== undefined) allowed.plan         = body.plan;
  if (body.is_suspended !== undefined) allowed.is_suspended = body.is_suspended;
  if (body.is_admin    !== undefined) allowed.is_admin     = body.is_admin;

  if (Object.keys(allowed).length === 0) {
    return c.json({ error: 'No updatable fields provided' }, 400);
  }

  const { data, error } = await supabase
    .from('users')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

admin.delete('/users/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();

  const { error } = await supabase
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

admin.get('/stats', async (c) => {
  const supabase = getSupabaseAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: active7d },
    { data: planCounts },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),

    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_suspended', false)
      .gte('updated_at', sevenDaysAgo),

    supabase
      .from('users')
      .select('plan')
      .is('deleted_at', null)
      .in('plan', ['build', 'pro', 'power']),
  ]);

  const planMap = { build: 0, pro: 0, power: 0 } as { build: number; pro: number; power: number };
  (planCounts ?? []).forEach((row) => {
    const p = (row as { plan: string }).plan as keyof typeof planMap;
    if (p in planMap) planMap[p]++;
  });

  const paidUsers = planMap.build + planMap.pro + planMap.power;
  const estimatedMrr =
    planMap.build * 9 + planMap.pro * 19 + planMap.power * 39;

  return c.json({
    total_users:   totalUsers ?? 0,
    active_7d:     active7d   ?? 0,
    paid_users:    paidUsers,
    estimated_mrr: estimatedMrr,
    plan_breakdown: planMap,
  });
});

// ─── Models ───────────────────────────────────────────────────────────────────

admin.get('/models', async (c) => {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('models')
    .select('*')
    .order('layer', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

admin.post('/models', async (c) => {
  const supabase = getSupabaseAdmin();
  const body = await c.req.json<{
    id?: string;
    name: string;
    slug: string;
    provider: string;
    layer?: string;
    description?: string;
    tags?: string[];
    requires_key?: boolean;
    available?: boolean;
    phase?: string;
  }>();

  const { data, error } = await supabase
    .from('models')
    .insert(body)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

admin.patch('/models/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();
  const body = await c.req.json<Record<string, unknown>>();

  const { data, error } = await supabase
    .from('models')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

admin.delete('/models/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();

  const { error } = await supabase.from('models').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── Builds ───────────────────────────────────────────────────────────────────

admin.get('/builds', async (c) => {
  const supabase = getSupabaseAdmin();
  const page      = Math.max(1, parseInt(c.req.query('page')    ?? '1', 10));
  const limit     = Math.max(1, parseInt(c.req.query('limit')   ?? '20', 10));
  const status    = c.req.query('status');
  const userId    = c.req.query('user_id');
  const fromDate  = c.req.query('from_date');
  const offset    = (page - 1) * limit;

  let query = supabase
    .from('build_runs')
    .select(
      'id, project_id, user_id, type, status, progress_pct, message, created_at, completed_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq('status', status);
  if (userId)   query = query.eq('user_id', userId);
  if (fromDate) query = query.gte('created_at', fromDate);

  const { data, error, count } = await query;

  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    data: data ?? [],
    page,
    limit,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
});

admin.get('/builds/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();

  const { data, error } = await supabase
    .from('build_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

admin.post('/builds/:id/cancel', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();

  const { data: build, error: fetchError } = await supabase
    .from('build_runs')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchError) return c.json({ error: fetchError.message }, 404);

  if (!['pending', 'running'].includes((build as { status: string }).status)) {
    return c.json({ error: 'Build is not in a cancellable state' }, 400);
  }

  const { data, error } = await supabase
    .from('build_runs')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ─── Incidents ────────────────────────────────────────────────────────────────

admin.get('/incidents', async (c) => {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

admin.post('/incidents', async (c) => {
  const supabase = getSupabaseAdmin();
  const body = await c.req.json<{
    title: string;
    status: string;
    description?: string;
    severity?: string;
  }>();

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

admin.patch('/incidents/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();
  const body = await c.req.json<Record<string, unknown>>();

  const { data, error } = await supabase
    .from('incidents')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

admin.delete('/incidents/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const { id } = c.req.param();

  const { error } = await supabase.from('incidents').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── Health (kept from original) ─────────────────────────────────────────────

// ─── 9B-2 Cost summary ────────────────────────────────────────────────────────

admin.get('/cost-summary', async (c) => {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('completion_costs')
    .select('provider, model, cost_usd, tokens_in, tokens_out, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) return c.json({ error: error.message }, 500);

  const byProvider = new Map<string, { cost: number; tokens: number; completions: number }>();
  let totalCost = 0;
  let totalCompletions = 0;

  for (const row of data ?? []) {
    const entry = byProvider.get(row.provider) ?? { cost: 0, tokens: 0, completions: 0 };
    entry.cost += Number(row.cost_usd);
    entry.tokens += Number(row.tokens_in) + Number(row.tokens_out);
    entry.completions += 1;
    byProvider.set(row.provider, entry);
    totalCost += Number(row.cost_usd);
    totalCompletions += 1;
  }

  return c.json({
    period: '30d',
    total_cost_usd: Number(totalCost.toFixed(4)),
    total_completions: totalCompletions,
    by_provider: Array.from(byProvider.entries()).map(([provider, stats]) => ({
      provider,
      cost_usd: Number(stats.cost.toFixed(4)),
      tokens: stats.tokens,
      completions: stats.completions,
    })),
  });
});

// ─── 9B-6 Eval results ────────────────────────────────────────────────────────

admin.get('/evals/latest', async (c) => {
  const sb = getSupabaseAdmin();
  const { data: latest } = await sb
    .from('eval_results')
    .select('run_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) {
    return c.json({ run_id: null, timestamp: null, results: [] });
  }

  const runId = latest[0]!.run_id;
  const { data: results, error } = await sb
    .from('eval_results')
    .select('*')
    .eq('run_id', runId);

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ run_id: runId, timestamp: latest[0]!.created_at, results: results ?? [] });
});

admin.get('/evals/trends', async (c) => {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('eval_results')
    .select('provider, model, score, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  const buckets = new Map<string, Map<string, { sum: number; count: number }>>();
  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    if (!buckets.has(day)) buckets.set(day, new Map());
    const inner = buckets.get(day)!;
    const entry = inner.get(row.provider) ?? { sum: 0, count: 0 };
    entry.sum += Number(row.score ?? 0);
    entry.count += 1;
    inner.set(row.provider, entry);
  }

  const trends = Array.from(buckets.entries()).flatMap(([day, providers]) =>
    Array.from(providers.entries()).map(([provider, stats]) => ({
      day,
      provider,
      avg_score: Number((stats.sum / stats.count).toFixed(3)),
      runs: stats.count,
    }))
  );

  return c.json({ period: '30d', trends });
});

admin.get('/health', async (c) => {
  const supabase = getSupabaseAdmin();

  const start = Date.now();
  const { error } = await supabase.from('projects').select('id').limit(1);
  const dbLatency = Date.now() - start;

  return c.json({
    status: error ? 'degraded' : 'healthy',
    dbLatency: `${dbLatency}ms`,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { admin };
