import { createHash, randomBytes } from 'crypto';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import { deleteUserStorage, purgeProjectStorage } from './file-storage';
import { teardownVercelProject } from './vercel-service';
import logger from '../lib/logger';

/**
 * Canonical account-deletion service. EVERY path that disables or erases an
 * account MUST go through here — the user-facing route, the admin endpoint, and
 * the cron hard-delete. This is the single place that guarantees billing-safety:
 * a Stripe subscription is always cancelled (at period end) on delete request,
 * and the irreversible data purge is BLOCKED while a live subscription remains.
 *
 * Founder decisions baked in:
 *   ① Stripe-cancel failure → retry with backoff, never swallow. Purge is
 *      blocked while an uncancelled sub exists (blocking the purge does not grant
 *      access — access hangs off the subscription, not leftover rows).
 *   ② Soft-delete + 10-day reactivable grace, then cron hard-delete.
 *   ③ Cancel at period end (cancel_at_period_end) — the user keeps what they paid.
 */

export const GRACE_PERIOD_DAYS = 10;
const CANCELLATION_TOKEN_VALIDITY_HOURS = 24 * GRACE_PERIOD_DAYS;
const CANCEL_MAX_ATTEMPTS = 3;

const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  return _stripe;
}

// Stripe statuses where no further billing can occur → safe to purge data.
const PURGE_SAFE_SUB_STATUS = new Set<Stripe.Subscription.Status>([
  'canceled',
  'incomplete_expired',
]);

interface CancelOutcome {
  requested: boolean; // was there a subscription to cancel at all?
  confirmed: boolean; // did Stripe confirm cancel_at_period_end?
  attempts: number;
  error?: string;
}

/**
 * Set cancel_at_period_end=true on the user's subscription, retrying with
 * backoff on transient failure. NEVER swallows — the outcome (including the
 * error after exhausting retries) is returned to the caller and persisted.
 */
async function cancelSubscriptionAtPeriodEnd(userId: string): Promise<CancelOutcome> {
  const stripe = getStripe();
  if (!stripe) return { requested: false, confirmed: false, attempts: 0, error: 'stripe_unconfigured' };

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();

  const subId = data?.stripe_subscription_id as string | null | undefined;
  if (!subId) return { requested: false, confirmed: true, attempts: 0 };

  let lastError = '';
  for (let attempt = 1; attempt <= CANCEL_MAX_ATTEMPTS; attempt++) {
    try {
      const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
      const confirmed =
        sub.cancel_at_period_end === true || PURGE_SAFE_SUB_STATUS.has(sub.status);
      if (confirmed) return { requested: true, confirmed: true, attempts: attempt };
      lastError = `stripe did not confirm cancel (status=${sub.status})`;
    } catch (e) {
      lastError = (e as Error).message;
      logger.warn(
        { userIdHash: sha256(userId), attempt, error: lastError },
        'account-deletion: stripe cancel attempt failed',
      );
    }
    if (attempt < CANCEL_MAX_ATTEMPTS) await sleep(attempt * 400);
  }
  return { requested: true, confirmed: false, attempts: CANCEL_MAX_ATTEMPTS, error: lastError };
}

export interface RequestDeletionResult {
  ok: boolean;
  alreadyPending?: boolean;
  scheduledHardDeleteAt?: string;
  cancellationToken?: string;
  stripeCancelConfirmed?: boolean;
  error?: string;
  status?: number;
}

/**
 * REQUEST DELETION (soft-delete). Cancels the subscription at period end, then
 * schedules the hard-delete and makes the account inaccessible-but-reactivable.
 * A failed Stripe cancel does NOT abort the soft-delete — it is recorded as
 * unconfirmed and the cron will block the purge until a clean cancel is seen.
 */
export async function requestAccountDeletion(userId: string): Promise<RequestDeletionResult> {
  const supabase = getSupabaseAdmin();

  const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(userId);
  if (userErr || !userResp?.user?.email) {
    logger.error({ userId, error: userErr?.message }, 'account-deletion: user lookup failed');
    return { ok: false, error: 'User not found', status: 404 };
  }
  const userEmail = userResp.user.email;

  const { data: existing } = await supabase
    .from('account_deletions')
    .select('status, scheduled_hard_delete_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.status === 'pending') {
    return {
      ok: false,
      alreadyPending: true,
      scheduledHardDeleteAt: existing.scheduled_hard_delete_at,
      error: 'Account deletion already requested',
      status: 409,
    };
  }

  // ③ cancel at period end (retry, never swallow).
  const cancel = await cancelSubscriptionAtPeriodEnd(userId);

  const cancellationToken = randomBytes(32).toString('hex');
  const scheduledHardDeleteAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 86400 * 1000);
  const cancellationTokenExpiresAt = new Date(
    Date.now() + CANCELLATION_TOKEN_VALIDITY_HOURS * 3600 * 1000,
  );

  const { error: upsertErr } = await supabase.from('account_deletions').upsert(
    {
      user_id: userId,
      requested_at: new Date().toISOString(),
      scheduled_hard_delete_at: scheduledHardDeleteAt.toISOString(),
      status: 'pending',
      cancellation_token: cancellationToken,
      cancellation_token_expires_at: cancellationTokenExpiresAt.toISOString(),
      hard_delete_attempted_at: null,
      hard_delete_completed_at: null,
      hard_delete_error: null,
      stripe_cancel_requested: cancel.requested,
      stripe_cancel_confirmed: cancel.confirmed,
      stripe_cancel_attempts: cancel.attempts,
      stripe_cancel_last_error: cancel.error ?? null,
      purge_blocked: false,
      purge_blocked_reason: null,
      purge_blocked_at: null,
      metadata: { email_hash: sha256(userEmail) },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertErr) {
    logger.error({ userId, error: upsertErr.message }, 'account-deletion: insert failed');
    return { ok: false, error: 'Could not request deletion', status: 500 };
  }

  if (cancel.requested && !cancel.confirmed) {
    logger.error(
      { userIdHash: sha256(userId), attempts: cancel.attempts, error: cancel.error },
      'account-deletion: STRIPE CANCEL UNCONFIRMED — purge will be blocked until cancel succeeds',
    );
  }

  // Soft-delete marker on the app row (admin lists filter on this).
  await supabase
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId);

  await supabase.from('deletion_audit_log').insert({
    user_id_hash: sha256(userId),
    user_email_hash: sha256(userEmail),
    event_type: 'requested',
    metadata: {
      grace_period_days: GRACE_PERIOD_DAYS,
      scheduled_hard_delete_at: scheduledHardDeleteAt.toISOString(),
      stripe_cancel_confirmed: cancel.confirmed,
    },
  });

  // Ban for the grace period — blocks logins, preserves data, reactivable.
  const { error: banErr } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: `${GRACE_PERIOD_DAYS * 24}h`,
    user_metadata: {
      ...(userResp.user.user_metadata ?? {}),
      deletion_requested_at: new Date().toISOString(),
      deletion_status: 'pending',
    },
  });
  if (banErr) logger.error({ userId, error: banErr.message }, 'account-deletion: ban failed');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://justgoblin.com';
  const cancellationUrl = `${appUrl}/cancel-deletion?token=${cancellationToken}`;
  const dateDe = scheduledHardDeleteAt.toLocaleDateString('de-DE');

  await sendEmail({
    to: userEmail,
    subject: 'Goblin: Konto-Löschung beantragt',
    html: `
      <h2>Deine Konto-Löschung wurde beantragt</h2>
      <p>Dein Goblin-Konto wird am <strong>${dateDe}</strong> (in ${GRACE_PERIOD_DAYS} Tagen) unwiderruflich gelöscht.</p>
      <p>Dein Abo wurde zum Ende der laufenden Abrechnungsperiode gekündigt — du behältst den bezahlten Zeitraum.</p>
      <p>Während dieser Zeit kannst du dich nicht einloggen. Falls du die Löschung stoppen möchtest, klicke hier:</p>
      <p><a href="${cancellationUrl}" style="background:#2D4A2B;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">Löschung abbrechen</a></p>
      <p style="color:#666;font-size:14px">
        Dieser Link ist ${GRACE_PERIOD_DAYS} Tage gültig. Wenn du nichts tust, werden alle deine Daten (Chats, Projekte, BYOK-Keys, Dateien) am ${dateDe} unwiderruflich gelöscht.
      </p>
    `,
  });

  logger.info(
    {
      userIdHash: sha256(userId),
      scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString(),
      stripeCancelConfirmed: cancel.confirmed,
    },
    'account-deletion: requested',
  );

  return {
    ok: true,
    scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString(),
    cancellationToken,
    stripeCancelConfirmed: cancel.confirmed,
  };
}

/** Remove cancel_at_period_end on the user's subscription (reactivation). */
async function uncancelSubscription(userId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  const subId = data?.stripe_subscription_id as string | null | undefined;
  if (!subId) return;
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    // Only un-cancel if the sub is still live (not already fully canceled).
    if (!PURGE_SAFE_SUB_STATUS.has(sub.status)) {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
    }
  } catch (e) {
    logger.warn(
      { userIdHash: sha256(userId), error: (e as Error).message },
      'account-deletion: uncancel sub failed (reactivation continues)',
    );
  }
}

export interface ReactivateResult {
  ok: boolean;
  error?: string;
  status?: number;
}

async function reactivate(userId: string, userEmail?: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await uncancelSubscription(userId);

  await supabase
    .from('account_deletions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  await supabase.from('users').update({ deleted_at: null }).eq('id', userId);

  await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
    user_metadata: { deletion_status: 'cancelled' },
  });

  await supabase.from('deletion_audit_log').insert({
    user_id_hash: sha256(userId),
    user_email_hash: userEmail ? sha256(userEmail) : 'unknown',
    event_type: 'cancelled',
  });

  logger.info({ userIdHash: sha256(userId) }, 'account-deletion: reactivated');
}

/** REACTIVATE via cancellation token (used by the public cancel-deletion route). */
export async function reactivateByToken(token: string): Promise<ReactivateResult> {
  const supabase = getSupabaseAdmin();
  const { data: deletion, error: findErr } = await supabase
    .from('account_deletions')
    .select('user_id, status, cancellation_token_expires_at')
    .eq('cancellation_token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (findErr || !deletion) return { ok: false, error: 'Invalid or expired cancellation token', status: 404 };
  if (new Date(deletion.cancellation_token_expires_at) < new Date())
    return { ok: false, error: 'Cancellation token expired', status: 410 };

  const { data: userResp } = await supabase.auth.admin.getUserById(deletion.user_id);
  await reactivate(deletion.user_id, userResp?.user?.email);
  return { ok: true };
}

/** REACTIVATE by user id (admin / programmatic). */
export async function reactivateByUserId(userId: string): Promise<ReactivateResult> {
  const supabase = getSupabaseAdmin();
  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  await reactivate(userId, userResp?.user?.email);
  return { ok: true };
}

export interface HardDeleteOutcome {
  purged: boolean;
  blocked: boolean;
  reason?: string;
}

/**
 * Verify the subscription can no longer bill. Returns null when safe to purge,
 * or a block-reason string when a live subscription still exists.
 */
async function blockReasonForLiveSub(userId: string): Promise<string | null> {
  const stripe = getStripe();
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  const subId = data?.stripe_subscription_id as string | null | undefined;
  if (!subId || !stripe) return null; // no sub (or stripe off) → nothing can bill

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    const msg = (e as Error).message;
    // A missing subscription (deleted in Stripe) is safe; any other API error
    // is treated as a block so we never purge on an unverified state.
    if (/No such subscription|resource_missing/i.test(msg)) return null;
    return `stripe_verify_failed: ${msg}`;
  }

  if (PURGE_SAFE_SUB_STATUS.has(sub.status)) return null; // fully terminated → safe

  // Still live. Make sure it is at least set to cancel; retry if not.
  if (sub.cancel_at_period_end) return 'waiting_period_end';

  const retry = await cancelSubscriptionAtPeriodEnd(userId);
  return retry.confirmed ? 'waiting_period_end' : `cancel_unconfirmed: ${retry.error ?? 'unknown'}`;
}

/** Detach payment methods + delete the Stripe customer. Best-effort (no sub left → cannot bill). */
async function deleteStripeCustomer(userId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | null | undefined;
  if (!customerId) return;

  try {
    const pms = await stripe.paymentMethods.list({ customer: customerId, limit: 100 });
    for (const pm of pms.data) {
      await stripe.paymentMethods.detach(pm.id).catch((e) =>
        logger.warn({ userIdHash: sha256(userId), pm: pm.id, error: (e as Error).message }, 'pm detach failed'),
      );
    }
    await stripe.customers.del(customerId);
    logger.info({ userIdHash: sha256(userId) }, 'account-deletion: stripe customer deleted');
  } catch (e) {
    logger.error(
      { userIdHash: sha256(userId), error: (e as Error).message },
      'account-deletion: stripe customer delete failed (no live sub → no billing risk)',
    );
  }
}

/**
 * HARD DELETE one user. BLOCKS the irreversible purge while a live subscription
 * remains. Only when no sub can bill: detach PM + delete customer, purge the
 * cascade gaps (build_runs, waitlist) + storage explicitly, then auth-delete.
 */
export async function hardDeleteUser(userId: string): Promise<HardDeleteOutcome> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('account_deletions')
    .update({ hard_delete_attempted_at: new Date().toISOString() })
    .eq('user_id', userId);

  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userResp?.user?.email;

  // ① BLOCK if a live subscription could still bill.
  const blockReason = await blockReasonForLiveSub(userId);
  if (blockReason) {
    const loud = blockReason.startsWith('cancel_unconfirmed') || blockReason.startsWith('stripe_verify_failed');
    const logFn = loud ? logger.error : logger.warn;
    logFn.call(
      logger,
      { userIdHash: sha256(userId), reason: blockReason },
      loud
        ? 'account-deletion: PURGE BLOCKED — live subscription could not be confirmed cancelled (ALERT)'
        : 'account-deletion: purge held — subscription cancels at period end, retry next run',
    );
    await supabase
      .from('account_deletions')
      .update({
        purge_blocked: true,
        purge_blocked_reason: blockReason,
        purge_blocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return { purged: false, blocked: true, reason: blockReason };
  }

  // Clear any prior block flag (state recovered).
  await supabase
    .from('account_deletions')
    .update({ purge_blocked: false, purge_blocked_reason: null, purge_blocked_at: null })
    .eq('user_id', userId);

  // ② No live sub → safe to erase. Remove the Stripe customer + payment methods.
  await deleteStripeCustomer(userId);

  // Explicit cascade-gap cleanup (FK-less / formerly-RESTRICT tables) — not swallowed.
  const { error: brErr } = await supabase.from('build_runs').delete().eq('user_id', userId);
  if (brErr) throw new Error(`build_runs delete failed: ${brErr.message}`);
  const { error: wlErr } = await supabase.from('goblin_hosted_waitlist').delete().eq('user_id', userId);
  if (wlErr) throw new Error(`goblin_hosted_waitlist delete failed: ${wlErr.message}`);

  // I3 (WAVE-I): behaviour events are personal data and carry NO FK to
  // auth.users, so they do NOT cascade on the auth delete below — purge them
  // explicitly (GDPR Art. 17). Tolerate a pre-migration absence (0078/0085 not
  // applied → no rows to erase) so a measurement table can never BLOCK a
  // deletion; any other error is a real failure to erase existing PII and must
  // stop the purge, exactly like the tables above.
  const { error: peErr } = await supabase.from('platform_events').delete().eq('user_id', userId);
  if (peErr && peErr.code !== '42P01' && !/does not exist/i.test(peErr.message)) {
    throw new Error(`platform_events delete failed: ${peErr.message}`);
  }

  // WAVE-J (I3): support tickets (escalation transcripts) and feedback are personal
  // data — the ticket transcript is the one content-bearing support surface, and
  // feedback bodies are user-authored. Both are FK-less (like platform_events) → no
  // cascade → purge explicitly. Same pre-migration tolerance (0086/0087 not applied
  // yet → nothing to erase); any other error stops the purge (never silently skip
  // existing PII).
  const { error: stErr } = await supabase.from('support_tickets').delete().eq('user_id', userId);
  if (stErr && stErr.code !== '42P01' && !/does not exist/i.test(stErr.message)) {
    throw new Error(`support_tickets delete failed: ${stErr.message}`);
  }
  const { error: fbErr } = await supabase.from('feedback').delete().eq('user_id', userId);
  if (fbErr && fbErr.code !== '42P01' && !/does not exist/i.test(fbErr.message)) {
    throw new Error(`feedback delete failed: ${fbErr.message}`);
  }

  const removed = await deleteUserStorage(userId);
  logger.info({ userIdHash: sha256(userId), objects: removed }, 'account-deletion: user storage purged');

  // GDPR (Art. 17): the user's PROJECT files under projects/<id>/ (incl. each
  // project's .trash/) must be purged too — the DB rows cascade below, but the B2
  // objects would otherwise be orphaned forever. Enumerate BEFORE the auth cascade
  // (which deletes the projects rows), then purge every prefix. This is resumable:
  // on any partial failure we throw, leaving account_deletions.status = 'pending'
  // so the cron re-runs and re-purges (purgeProjectStorage is idempotent).
  const { data: userProjects, error: projErr } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId);
  if (projErr) throw new Error(`projects lookup failed: ${projErr.message}`);
  const projectIds = (userProjects ?? []).map((p) => p.id as string);

  // D-5 (WAVE-D) / DD-hardening FW6-U3: tear down each project's LIVE Vercel
  // resource BEFORE the DB cascade drops the rows. Without this, a deleted user's
  // <slug>.vercel.app deployments stay public (and billable on the user's own
  // connected token) forever — a real-user data-retention gap the storage/DB purge
  // did not cover.
  //
  // FW6-U3 makes this the SAME blocking-throw its sibling storage-purge (below)
  // already uses: a teardown that is not confirmed gone BLOCKS the cascade so the
  // projects rows — and thus the slugs we need to retry — survive, and the delete
  // stays 'pending' for the next cron pass. teardownVercelProject is idempotent
  // (404 / no-token = already gone → ok:true), so re-running is safe, and a
  // deployment the token can genuinely no longer reach (no token stored) never
  // reaches this list. Net effect: a deleted user's site is GUARANTEED to come
  // down before their PII rows are dropped, not merely attempted once.
  const failedTeardowns: string[] = [];
  for (const proj of userProjects ?? []) {
    const name = (proj as { name?: string }).name;
    if (!name) continue;
    const td = await teardownVercelProject(userId, name);
    if (!td.ok) {
      failedTeardowns.push(name);
      logger.warn(
        { userIdHash: sha256(userId), status: td.status, reason: td.error },
        'account-deletion: vercel teardown not confirmed — purge held, retry next cron pass',
      );
    }
  }

  if (projectIds.length > 0) {
    const purge = await purgeProjectStorage(projectIds);
    logger.info(
      {
        userIdHash: sha256(userId),
        requested: purge.requested,
        verifiedEmpty: purge.purged.length,
        objects: purge.objectsDeleted,
        failed: purge.failed.length,
      },
      'account-deletion: project storage purged',
    );
    if (purge.failed.length > 0) {
      // Do NOT proceed to the cascade — that would drop the projects rows and lose
      // the ids we need to retry. Leave status 'pending' for the next cron run.
      throw new Error(
        `project storage purge incomplete: ${purge.failed.length}/${purge.requested} prefixes not verified empty `
        + `(${purge.failed.map((f) => f.projectId).join(', ')})`,
      );
    }
  }

  // FW6-U3: a deleted user's SITE must come down. If any Vercel teardown was not
  // confirmed, BLOCK the cascade (same posture as the storage purge above) so the
  // projects rows survive and the cron re-runs the teardown next pass. Only once
  // every live deployment is gone do we drop the PII rows below.
  if (failedTeardowns.length > 0) {
    throw new Error(
      `vercel teardown incomplete: ${failedTeardowns.length}/${(userProjects ?? []).length} project(s) still live `
      + `(${failedTeardowns.join(', ')}) — site must come down before the PII cascade; cron will retry`,
    );
  }

  // D-5 (WAVE-D): purge the user's BYOK KEK from Vault. byok_keys rows cascade from
  // auth.users but the vault.secrets KEK (byok_kek_user_<id>) is referenced with
  // ON DELETE SET NULL, so it would be orphaned otherwise. Idempotent RPC (0090);
  // pre-migration tolerant — a missing function is logged, never blocks the delete.
  try {
    const { error: kekErr } = await supabase.rpc('delete_user_kek', { p_user_id: userId });
    if (kekErr && !/does not exist|schema cache|PGRST202|42883/i.test(`${kekErr.code ?? ''} ${kekErr.message ?? ''}`)) {
      logger.warn({ userIdHash: sha256(userId), reason: kekErr.message }, 'account-deletion: KEK purge failed (non-fatal)');
    }
  } catch (e) {
    logger.warn({ userIdHash: sha256(userId), reason: (e as Error).message }, 'account-deletion: KEK purge threw (non-fatal)');
  }

  // The cascade purge — every PII-bearing table cascades from auth.users.
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

  logger.info({ userIdHash: sha256(userId) }, 'account-deletion: user hard-deleted');
  return { purged: true, blocked: false };
}

export interface HardDeleteResult {
  attempted: number;
  succeeded: number;
  blocked: number;
  failed: number;
  errors: Array<{ userIdHash: string; error: string }>;
}

/** CRON: hard-delete every pending account whose grace period has elapsed. */
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
    return { attempted: 0, succeeded: 0, blocked: 0, failed: 0, errors: [] };
  }
  if (!due || due.length === 0) {
    logger.info('hard-delete cron: no pending deletions due');
    return { attempted: 0, succeeded: 0, blocked: 0, failed: 0, errors: [] };
  }

  logger.info({ count: due.length }, 'hard-delete cron: processing pending deletions');

  const errors: Array<{ userIdHash: string; error: string }> = [];
  let succeeded = 0;
  let blocked = 0;

  for (const record of due) {
    const userId = record.user_id as string;
    try {
      const outcome = await hardDeleteUser(userId);
      if (outcome.purged) succeeded++;
      else if (outcome.blocked) blocked++;
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

  return { attempted: due.length, succeeded, blocked, failed: errors.length, errors };
}
