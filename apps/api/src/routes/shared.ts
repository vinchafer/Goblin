import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const shared = new Hono();

/**
 * GET /api/shared/:token
 * Public read-only view of a chat that the owner has opted to share.
 */
shared.get('/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'Missing token' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, share_token')
    .eq('share_token', token)
    .maybeSingle();
  if (!session) return c.json({ error: 'Not found or no longer shared' }, 404);

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });

  return c.json({
    session: {
      id: session.id,
      title: session.title,
      created_at: session.created_at,
    },
    messages: messages ?? [],
  });
});

export { shared };
