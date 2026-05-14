import { createMiddleware } from 'hono/factory';
import { getSupabaseAdmin } from '../lib/supabase';
import { getPlans } from '../config/plans';

export const usageLimitMiddleware = createMiddleware(async (c, next) => {
  const userId = c.get('userId');

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from('users')
    .select('plan, monthly_requests_used, monthly_limit, subscription_current_period_end')
    .eq('id', userId)
    .single();

  if (error) {
    return c.json({ error: 'Failed to check usage limit' }, 500);
  }

  if (!user) {
    // User exists in auth but not in users table — allow with free-tier defaults
    // (happens when onboarding trigger fails; don't block valid auth users)
    return next();
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

  const plans = getPlans();
  const limit = user.monthly_limit ?? plans[user.plan ?? 'build']?.monthlyRequests ?? 200;

  if (used >= limit) {
    return c.json({ error: 'Monthly request limit reached. Upgrade your plan.' }, 429);
  }

  // Atomic conditional increment — prevents race condition on concurrent requests.
  // Only updates if monthly_requests_used hasn't changed since we read it.
  const { data: updated } = await supabase
    .from('users')
    .update({ monthly_requests_used: used + 1 })
    .eq('id', userId)
    .eq('monthly_requests_used', used)
    .select('id');

  if (!updated || updated.length === 0) {
    return c.json({ error: 'Monthly request limit reached. Upgrade your plan.' }, 429);
  }

  await next();
});
