import logger from './logger';
import { runRankingsAggregator } from './rankings/aggregator';
import { hardDeletePendingAccounts } from '../jobs/hard-delete-pending-accounts';
import { expireStaleSessions } from '../jobs/expire-stale-sessions';
import { reconcileStorage } from '../jobs/reconcile-storage';
import { recoverStuckWebhookJobs } from '../services/stripe-webhook-processor';
import { retryFailedRefunds } from '../services/billing-service';
import { sendFounderDigest } from '../services/insight-digest';
import { sendFeedbackDigest } from '../services/feedback';
import { pruneAgentAutoCheckpoints } from '../services/checkpoints/retention';

let scheduled = false;

/**
 * Lightweight in-process scheduler. No-op unless ENABLE_CRON=true.
 * Rankings aggregator: every 6h (00, 06, 12, 18 UTC).
 * Hard-delete pending accounts: daily at 03:00 UTC.
 */
export function startCron(): void {
  if (scheduled) return;
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('cron disabled (ENABLE_CRON != true)');
    return;
  }

  let lastRankingsSlot = -1;
  let lastHardDeleteDay = -1;
  let lastSessionSweepHour = -1;
  let lastStorageReconcileDay = -1;
  let lastWebhookRecoverySlot = -1;
  let lastRefundRetrySlot = -1;
  let lastDigestDay = -1;
  let lastFeedbackDigestDay = -1;
  let lastCheckpointPruneDay = -1;

  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDate();

    // Stripe webhook recovery — every 5 minutes. Re-applies failed / stale-pending
    // webhook jobs from their stored payload (durability backstop for the ACK-fast
    // async processing: since we 200 before side-effects, Stripe won't retry, so a
    // process restart mid-flight is recovered here).
    const recoverySlot = Math.floor(utcMinute / 5);
    if (lastWebhookRecoverySlot !== recoverySlot) {
      lastWebhookRecoverySlot = recoverySlot;
      recoverStuckWebhookJobs().catch((e) =>
        logger.error({ error: (e as Error).message }, 'cron stripe-webhook recovery failed'),
      );
    }

    // Refund retry (DD-hardening FW6-U1) — every 5 minutes. Re-runs failed / pending
    // credit-refund jobs (refund_jobs) so a refund that couldn't complete on the
    // subscription.deleted webhook (no refundable charge yet, a Stripe hiccup) is not
    // silently lost — the money owed to a churned user is returned on a later sweep.
    // Idempotency-keyed per subscription in Stripe, so replay never double-refunds.
    const refundRetrySlot = Math.floor(utcMinute / 5);
    if (lastRefundRetrySlot !== refundRetrySlot) {
      lastRefundRetrySlot = refundRetrySlot;
      retryFailedRefunds().catch((e) =>
        logger.error({ error: (e as Error).message }, 'cron refund-retry failed'),
      );
    }

    const slot = Math.floor(utcHour / 6);
    if (utcHour % 6 === 0 && utcMinute < 2 && lastRankingsSlot !== slot) {
      lastRankingsSlot = slot;
      logger.info('cron tick — firing rankings aggregator');
      runRankingsAggregator().catch((e) =>
        logger.error({ error: (e as Error).message }, 'cron rankings failed'),
      );
    }

    if (utcMinute < 2 && lastSessionSweepHour !== utcHour) {
      lastSessionSweepHour = utcHour;
      expireStaleSessions().catch((e) =>
        logger.error({ error: (e as Error).message }, 'cron expire-stale-sessions failed'),
      );
    }

    if (utcHour === 3 && utcMinute < 2 && lastHardDeleteDay !== utcDay) {
      lastHardDeleteDay = utcDay;
      logger.info('cron tick — firing hard-delete pending accounts');
      hardDeletePendingAccounts()
        .then((result) => logger.info(result, 'hard-delete cron: completed'))
        .catch((e) =>
          logger.error({ error: (e as Error).message }, 'cron hard-delete failed'),
        );
    }

    // Storage reconcile — daily 03:30 UTC (after hard-delete, so purged accounts'
    // objects are already gone). Corrects users.storage_bytes drift against B2.
    if (utcHour === 3 && utcMinute >= 30 && utcMinute < 32 && lastStorageReconcileDay !== utcDay) {
      lastStorageReconcileDay = utcDay;
      logger.info('cron tick — firing storage reconcile');
      reconcileStorage()
        .then((result) => logger.info(result, 'storage reconcile cron: completed'))
        .catch((e) =>
          logger.error({ error: (e as Error).message }, 'cron storage reconcile failed'),
        );
    }

    // WAVE-F F5 — checkpoint retention prune, daily 03:45 UTC (after storage reconcile).
    // Deletes stale agent-AUTO checkpoints (older than CHECKPOINT_RETENTION_DAYS, default
    // 30) except the pre-run snapshot of the last CHECKPOINT_KEEP_LAST_RUNS runs, then GCs
    // orphan blobs — the storage-COGS control for the safety net. Pre-0095 tolerant (no
    // table → no-op). Keeps ALL user + publish checkpoints forever.
    if (utcHour === 3 && utcMinute >= 45 && utcMinute < 47 && lastCheckpointPruneDay !== utcDay) {
      lastCheckpointPruneDay = utcDay;
      pruneAgentAutoCheckpoints()
        .then((r) => logger.info(r, 'checkpoint prune cron: completed'))
        .catch((e) => logger.error({ error: (e as Error).message }, 'cron checkpoint prune failed'));
    }

    // I4 (WAVE-I) — founder insight digest, daily 07:00 UTC. Self-gates on
    // GOBLIN_FOUNDER_DIGEST=true + a recipient (silent no-op otherwise), so this
    // tick is free unless the founder opts in. One send/day, existing Resend.
    if (utcHour === 7 && utcMinute < 2 && lastDigestDay !== utcDay) {
      lastDigestDay = utcDay;
      sendFounderDigest()
        .then((r) => { if (r.sent) logger.info('founder digest: sent'); })
        .catch((e) => logger.error({ error: (e as Error).message }, 'cron founder digest failed'));
    }

    // J3 (WAVE-J) — feedback daily digest (ideas/other), 07:05 UTC. Self-gates on
    // GOBLIN_FEEDBACK_DIGEST=true + recipient (silent no-op otherwise). Bugs are
    // emailed immediately from the request path, so the digest is the slow lane.
    if (utcHour === 7 && utcMinute >= 5 && utcMinute < 7 && lastFeedbackDigestDay !== utcDay) {
      lastFeedbackDigestDay = utcDay;
      sendFeedbackDigest()
        .then((r) => { if (r.sent) logger.info('feedback digest: sent'); })
        .catch((e) => logger.error({ error: (e as Error).message }, 'cron feedback digest failed'));
    }
  }, 60_000);

  scheduled = true;
  logger.info('cron scheduled — rankings 6h, hard-delete daily 03:00 UTC, storage reconcile daily 03:30 UTC, checkpoint prune daily 03:45 UTC, session sweep hourly, stripe-webhook recovery every 5min, refund-retry every 5min, founder digest daily 07:00 UTC (opt-in)');
}
