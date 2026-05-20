import { getSupabaseAdmin } from '../lib/supabase';

const SOFT_LIMIT_REQUESTS_PER_DAY = 20;

export interface SoftLimitStatus {
  hasKey: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  requestsToday: number;
  requestsLimit: number | null; // null = unlimited
  blocked: boolean;
  blockReason?: string;
  isComped?: boolean;
}

export async function getSoftLimitStatus(userId: string): Promise<SoftLimitStatus> {
  const supabase = getSupabaseAdmin();

  // Comped users bypass trial + soft limits entirely.
  const { data: compRow } = await supabase
    .from('users')
    .select('is_comped')
    .eq('id', userId)
    .maybeSingle();
  if (compRow?.is_comped) {
    return {
      hasKey: true,
      trialActive: false,
      trialDaysLeft: 0,
      requestsToday: 0,
      requestsLimit: null,
      blocked: false,
      isComped: true,
    };
  }

  // Does the user have any BYOK key?
  const { count: keyCount } = await supabase
    .from('byok_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const hasKey = (keyCount ?? 0) > 0;

  if (hasKey) {
    return {
      hasKey: true,
      trialActive: false,
      trialDaysLeft: 0,
      requestsToday: 0,
      requestsLimit: null,
      blocked: false,
    };
  }

  // Trial state lives on the existing `users` row (see migration 0030 + 0047).
  const { data: user } = await supabase
    .from('users')
    .select('cloud_trial_started_at, cloud_trial_ends_at, trial_ended_at')
    .eq('id', userId)
    .single();

  const now = new Date();
  const trialEnd = user?.cloud_trial_ends_at ? new Date(user.cloud_trial_ends_at as string) : null;
  const trialActive = !!trialEnd && !user?.trial_ended_at && now < trialEnd;
  const trialDaysLeft = trialActive && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000))
    : 0;

  const today = now.toISOString().split('T')[0];
  const { data: countRow } = await supabase
    .from('daily_request_counts')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  const requestsToday = (countRow?.count as number | undefined) ?? 0;

  if (trialActive) {
    return {
      hasKey: false,
      trialActive: true,
      trialDaysLeft,
      requestsToday,
      requestsLimit: null,
      blocked: false,
    };
  }

  // Trial finished and no key — apply the soft daily limit.
  const blocked = requestsToday >= SOFT_LIMIT_REQUESTS_PER_DAY;
  return {
    hasKey: false,
    trialActive: false,
    trialDaysLeft: 0,
    requestsToday,
    requestsLimit: SOFT_LIMIT_REQUESTS_PER_DAY,
    blocked,
    blockReason: blocked
      ? `Tageslimit (${SOFT_LIMIT_REQUESTS_PER_DAY} Anfragen) erreicht. Trag deinen eigenen Key ein für unbegrenzte Nutzung.`
      : undefined,
  };
}

export async function incrementRequestCount(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = getSupabaseAdmin();
  await supabase.rpc('increment_daily_request_count', {
    p_user_id: userId,
    p_date: today,
  });
}
