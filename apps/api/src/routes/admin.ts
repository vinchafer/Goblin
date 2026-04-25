import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const admin = new Hono();

admin.use('*', async (c, next) => {
  const adminSecret = c.req.header('x-admin-secret');
  const expectedSecret = process.env.ADMIN_SECRET;

  if (!expectedSecret || !adminSecret || adminSecret !== expectedSecret) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await next();
});

admin.get('/analytics', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('analytics_summary')
    .select('*')
    .single();

  return c.json(data);
});

export { admin };