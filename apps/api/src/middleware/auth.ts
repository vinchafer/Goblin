import { createMiddleware } from 'hono/factory';
import { getSupabaseAdmin } from '../lib/supabase';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  console.log('Auth middleware:', { path: c.req.path, hasAuth: !!authHeader, prefix: authHeader?.slice(0, 20) });

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);

  const supabase = getSupabaseAdmin();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('userId', user.id);
  await next();
});