import { createMiddleware } from 'hono/factory';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);

  const supabase = getSupabaseAdmin();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    logger.warn({ path: c.req.path }, 'auth_invalid_token');
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('userId', user.id);
  await next();
});