import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const admin = new Hono();

// Admin routes require ADMIN_API_KEY header
admin.use('*', async (c, next) => {
  const adminKey = c.req.header('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || !adminKey || adminKey !== expectedKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});

// Admin dashboard analytics
admin.get('/analytics', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('analytics_summary')
    .select('*')
    .single();

  return c.json(data || {});
});

// List all users (basic admin endpoint)
admin.get('/users', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('id, email, created_at')
    .limit(100);

  return c.json(data || []);
});

// System health
admin.get('/health', async (c) => {
  const supabase = getSupabaseAdmin();

  // Quick DB check
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
