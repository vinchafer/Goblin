import { createClient } from '@supabase/supabase-js';
import { PLANS } from '../config/plans';

export async function usageLimitMiddleware(userId: string): Promise<{ allowed: boolean; error?: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabase
    .from('users')
    .select('plan, monthly_requests_used, monthly_limit, subscription_current_period_end')
    .eq('id', userId)
    .single();

  // Reset usage if period has ended
  if (user.subscription_current_period_end && new Date() > new Date(user.subscription_current_period_end)) {
    const planConfig = PLANS[user.plan] || PLANS.seed;
    
    await supabase
      .from('users')
      .update({
        monthly_requests_used: 0,
        monthly_limit: planConfig.monthlyRequests
      })
      .eq('id', userId);

    return { allowed: true };
  }

  const limit = user.monthly_limit || PLANS.seed.monthlyRequests;

  if (user.monthly_requests_used >= limit) {
    return {
      allowed: false,
      error: 'Monthly request limit reached. Upgrade your plan to continue using Goblin.'
    };
  }

  // Increment usage atomically
  await supabase
    .from('users')
    .update({ monthly_requests_used: user.monthly_requests_used + 1 })
    .eq('id', userId);

  return { allowed: true };
}