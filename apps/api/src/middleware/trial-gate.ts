import { createMiddleware } from 'hono/factory';
import { getSupabaseAdmin } from '../lib/supabase';

const TRIAL_DAYS = 3;

// Paths that skip the trial gate
const SKIP_PATHS = [
  '/api/billing',
  '/api/users',
  '/health',
  '/version',
  '/api/github/connect',
  '/api/github/callback',
];

// Check if request is BYOK-backed (no trial cost to Goblin)
function isByokPath(path: string): boolean {
  // BYOK requests hit /api/chat/stream or /api/projects/:id/generate
  // They skip trial only if we can determine they're BYOK — we can't at middleware level.
  // Trial gate applies only to Goblin-hosted and Free-API pool usage.
  // For now: trial blocks all cloud routes except BYOK settings and billing.
  return path.startsWith('/api/byok-keys');
}

export const trialGate = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // Skip non-gated paths
  if (SKIP_PATHS.some(p => path.startsWith(p)) || isByokPath(path)) {
    return next();
  }

  const userId = c.get('userId') as string | undefined;
  if (!userId) return next(); // auth middleware already handled this

  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id, cloud_trial_started_at, cloud_trial_ends_at, trial_extension_used')
    .eq('id', userId)
    .single();

  if (!user) return next();

  const plan = user.plan as string | null;
  const hasActiveSub = !!user.stripe_subscription_id;

  // Active subscriber → always pass
  if (hasActiveSub || (plan && plan !== 'free')) return next();

  // No trial started → start one
  if (!user.cloud_trial_started_at) {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86400000);
    await supabase
      .from('users')
      .update({
        cloud_trial_started_at: now.toISOString(),
        cloud_trial_ends_at: trialEnd.toISOString(),
      })
      .eq('id', userId);
    return next();
  }

  // Trial active?
  const trialEnd = new Date(user.cloud_trial_ends_at as string);
  if (new Date() <= trialEnd) return next();

  // Trial expired
  return c.json({
    error: 'trial_expired',
    message: 'Your free trial has ended. Upgrade to continue using Goblin Cloud.',
    upgradeUrl: '/dashboard/upgrade',
    code: 'trial_expired',
  }, 402);
});

// Extend trial by 2 days (one time)
export async function extendTrial(userId: string): Promise<{ success: boolean; newEnd: string | null }> {
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('cloud_trial_ends_at, trial_extension_used')
    .eq('id', userId)
    .single();

  if (!user || user.trial_extension_used) {
    return { success: false, newEnd: null };
  }

  const currentEnd = new Date(user.cloud_trial_ends_at as string);
  const newEnd = new Date(currentEnd.getTime() + 2 * 86400000);

  await supabase
    .from('users')
    .update({ cloud_trial_ends_at: newEnd.toISOString(), trial_extension_used: true })
    .eq('id', userId);

  return { success: true, newEnd: newEnd.toISOString() };
}
