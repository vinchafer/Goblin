import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MIN = 15;

export interface LockoutResult {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * Inspect login_attempts for the given email within the 15-minute window.
 * 5+ consecutive failures (no success in between) puts the email in lockout.
 */
export async function checkLockout(email: string): Promise<LockoutResult> {
  const supabase = getSupabaseAdmin();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MIN * 60 * 1000);

  const { data: attempts } = await supabase
    .from('login_attempts')
    .select('id, success, attempted_at')
    .eq('email', email.toLowerCase())
    .gte('attempted_at', windowStart.toISOString())
    .order('attempted_at', { ascending: false });

  if (!attempts || attempts.length === 0) {
    return { locked: false, remainingAttempts: LOCKOUT_THRESHOLD };
  }

  const lastSuccessIdx = attempts.findIndex((a) => a.success === true);
  const failuresSinceSuccess =
    lastSuccessIdx === -1
      ? attempts.filter((a) => !a.success)
      : attempts.slice(0, lastSuccessIdx).filter((a) => !a.success);

  if (failuresSinceSuccess.length >= LOCKOUT_THRESHOLD) {
    const oldest = failuresSinceSuccess[failuresSinceSuccess.length - 1];
    const lockoutEnd = new Date(
      new Date(oldest!.attempted_at).getTime() + LOCKOUT_WINDOW_MIN * 60 * 1000,
    );
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((lockoutEnd.getTime() - Date.now()) / 1000),
    );
    return { locked: true, remainingAttempts: 0, retryAfterSeconds };
  }

  return {
    locked: false,
    remainingAttempts: LOCKOUT_THRESHOLD - failuresSinceSuccess.length,
  };
}

export interface LogAttemptInput {
  email: string;
  success: boolean;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logLoginAttempt(input: LogAttemptInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('login_attempts').insert({
      email: input.email.toLowerCase(),
      success: input.success,
      failure_reason: input.failureReason ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'login_attempts insert failed');
  }
}
