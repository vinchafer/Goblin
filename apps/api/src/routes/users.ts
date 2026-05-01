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

export { users };
