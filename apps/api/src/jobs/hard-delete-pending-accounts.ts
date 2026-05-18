import { createHash } from 'crypto';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import { deleteUserStorage } from '../services/file-storage';
import logger from '../lib/logger';

const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

async function cancelUserStripeSubscription(userId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  const subId = data?.stripe_subscription_id;
  if (!subId) return;
  await stripe.subscriptions.cancel(subId, { invoice_now: false, prorate: false });
}

export interface HardDeleteResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ userIdHash: string; error: string }>;
}

/**
 * Hard-delete every pending account whose grace period elapsed. Best-effort
 * Stripe + storage cleanup; the critical step is the Supabase auth delete
 * because every PII-bearing table cascades from auth.users.
 */
export async function hardDeletePendingAccounts(): Promise<HardDeleteResult> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: due, error: findErr } = await supabase
    .from('account_deletions')
    .select('user_id')
    .eq('status', 'pending')
    .lte('scheduled_hard_delete_at', now);

  if (findErr) {
    logger.error({ error: findErr.message }, 'hard-delete cron: find failed');
    return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  }
  if (!due || due.length === 0) {
    logger.info('hard-delete cron: no pending deletions due');
    return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  }

  logger.info({ count: due.length }, 'hard-delete cron: processing pending deletions');

  const errors: Array<{ userIdHash: string; error: string }> = [];
  let succeeded = 0;

  for (const record of due) {
    const userId = record.user_id as string;
    try {
      await supabase
        .from('account_deletions')
        .update({ hard_delete_attempted_at: new Date().toISOString() })
        .eq('user_id', userId);

      const { data: userResp } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userResp?.user?.email;

      await cancelUserStripeSubscription(userId).catch((e) => {
        logger.warn(
          { userIdHash: sha256(userId), error: (e as Error).message },
          'hard-delete: stripe cancel failed',
        );
      });

      await deleteUserStorage(userId).catch((e) => {
        logger.warn(
          { userIdHash: sha256(userId), error: (e as Error).message },
          'hard-delete: storage delete failed',
        );
      });

      const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
      if (deleteErr) throw new Error(`Supabase user delete failed: ${deleteErr.message}`);

      await supabase
        .from('account_deletions')
        .update({
          status: 'completed',
          hard_delete_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      await supabase.from('deletion_audit_log').insert({
        user_id_hash: sha256(userId),
        user_email_hash: userEmail ? sha256(userEmail) : 'unknown',
        event_type: 'completed',
      });

      if (userEmail) {
        await sendEmail({
          to: userEmail,
          subject: 'Goblin: Konto wurde gelöscht',
          html: `
            <h2>Dein Goblin-Konto wurde gelöscht</h2>
            <p>Wie beantragt wurde dein Konto und alle damit verbundenen Daten unwiderruflich gelöscht.</p>
            <p>Falls du Feedback hast, antworte gerne auf diese Email.</p>
          `,
        });
      }

      succeeded++;
      logger.info({ userIdHash: sha256(userId) }, 'hard-delete: user deleted');
    } catch (e) {
      const errorMsg = (e as Error).message;
      errors.push({ userIdHash: sha256(userId), error: errorMsg });

      await supabase
        .from('account_deletions')
        .update({ hard_delete_error: errorMsg, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      await supabase.from('deletion_audit_log').insert({
        user_id_hash: sha256(userId),
        user_email_hash: 'unknown',
        event_type: 'failed',
        metadata: { error: errorMsg },
      });

      logger.error({ userIdHash: sha256(userId), error: errorMsg }, 'hard-delete: user delete failed');
    }
  }

  return {
    attempted: due.length,
    succeeded,
    failed: due.length - succeeded,
    errors,
  };
}
