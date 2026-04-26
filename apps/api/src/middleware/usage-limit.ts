import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import { PLANS } from '../config/plans';

export const usageLimitMiddleware = createMiddleware(async (c, next) => {
  const userId = c.get('userId');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user, error } = await supabase
    .from('users')
    .select('plan, monthly_requests_used, monthly_limit, subscription_current_period_end')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return c.json({ error: 'User not found' }, 404);
  }

  let used = user.monthly_requests_used ?? 0;

  // Reset usage if subscription period has ended
  if (user.subscription_current_period_end) {
    const periodEnd = new Date(user.subscription_current_period_end);
    if (new Date() > periodEnd) {
      await supabase
        .from('users')
        .update({ monthly_requests_used: 0 })
        .eq('id', userId);
      used = 0;
    }
  }

  const limit = user.monthly_limit ?? PLANS[user.plan ?? 'seed']?.monthlyRequests ?? 200;

  if (used >= limit) {
    return c.json({ error: 'Monthly request limit reached. Upgrade your plan.' }, 429);
  }

  // Increment usage count directly (no RPC dependency)
  await supabase
    .from('users')
    .update({ monthly_requests_used: used + 1 })
    .eq('id', userId);

  await next();
});