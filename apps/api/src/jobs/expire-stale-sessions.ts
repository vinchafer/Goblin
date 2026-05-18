import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

const SESSION_INACTIVE_TIMEOUT_HOURS = 24;

export async function expireStaleSessions(): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - SESSION_INACTIVE_TIMEOUT_HOURS * 3600 * 1000);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_sessions')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .lt('last_active_at', cutoff.toISOString())
    .eq('revoked', false)
    .select('id');

  if (error) {
    logger.error({ error: error.message }, 'expire-stale-sessions: query failed');
    return { expired: 0 };
  }

  const expired = data?.length ?? 0;
  if (expired > 0) {
    logger.info({ count: expired }, 'expire-stale-sessions: revoked stale sessions');
  }
  return { expired };
}
