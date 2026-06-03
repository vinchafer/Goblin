import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';

type Variables = { userId: string };
const waitlist = new Hono<{ Variables: Variables }>();

waitlist.use('*', authMiddleware);

// POST /api/waitlist/goblin-hosted — Layer 2 (Goblin-Hosted, Q1 2027) interest.
// Email is derived from the authenticated user; body is ignored. Idempotent on
// user_id (unique index in migration 0060). Best-effort — never blocks the flow.
waitlist.post('/goblin-hosted', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  let email = '';
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    email = data.user?.email ?? '';
  } catch { /* fall through with empty email */ }

  try {
    await supabase
      .from('goblin_hosted_waitlist')
      .upsert({ user_id: userId, email }, { onConflict: 'user_id' });
  } catch {
    // Table may not exist until migration 0060 is applied — degrade silently.
    return c.json({ success: true, persisted: false });
  }

  return c.json({ success: true, persisted: true });
});

export { waitlist };
