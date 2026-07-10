/**
 * Stripe webhook side-effect processor (webhook hardening, 2026-07-08).
 *
 * The route (routes/billing.ts) verifies the signature, claims the event in
 * `stripe_processed_events` (status='pending', raw payload stored), ACKs 200
 * immediately, then kicks this processor fire-and-forget. This module:
 *
 *   1. Applies the side-effects for the event type, with a per-call TIMEOUT on
 *      every Stripe API call, every Supabase write, and each business handler
 *      (WH2) — a stalled upstream can never hang forever.
 *   2. On success → marks the job `done`.
 *   3. On failure/timeout → marks the job `failed` (releasable) with the error
 *      recorded, and logs a structured error carrying event.id context (WH2/WH3).
 *      It NEVER re-throws to the caller (fire-and-forget must not crash the
 *      process); the failure lives in the job row instead.
 *
 * `recoverStuckWebhookJobs()` is the durability backstop: because we ACK 200
 * before processing, Stripe will not retry. A cron sweep re-runs `failed` jobs
 * and `pending` jobs that stalled (process restarted mid-flight) from the stored
 * payload. Handlers are idempotent at the entitlement level, and the job row
 * gates re-application, so replay is safe.
 *
 * Plumbing only — pricing/plan/amount/event semantics are unchanged; this moves
 * the SAME handler calls off the response path and bounds them in time.
 */
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';
import { withTimeout, envTimeoutMs, isTimeoutError } from '../lib/with-timeout';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from './billing-service';

// Per-call timeout budgets (env-overridable). Sane defaults: Stripe/Supabase
// calls that take longer than a few seconds indicate a stalled upstream, and the
// whole point of async processing is that we already ACKed — so failing fast and
// leaving the job releasable is strictly better than hanging.
const stripeTimeoutMs = () => envTimeoutMs('STRIPE_WEBHOOK_STRIPE_TIMEOUT_MS', 10_000);
const supabaseTimeoutMs = () => envTimeoutMs('STRIPE_WEBHOOK_SUPABASE_TIMEOUT_MS', 8_000);
const handlerTimeoutMs = () => envTimeoutMs('STRIPE_WEBHOOK_HANDLER_TIMEOUT_MS', 20_000);

// A pending job older than this is assumed abandoned (process restarted between
// ACK and completion) and is eligible for the recovery sweep.
const stalePendingMs = () => envTimeoutMs('STRIPE_WEBHOOK_STALE_PENDING_MS', 120_000);

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
}

/**
 * Apply the side-effects for a single event. Bounds every Stripe/Supabase call
 * in time. Throws (to the caller within this module) on any handler failure so
 * the job can be marked releasable — callers outside this module get the result
 * via the job row, never an exception.
 */
async function applySideEffects(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      // Legacy hosted-checkout path — entitlement write only (tier is whatever the
      // session was created with; the Elements/SetupIntent rebuild creates subs at
      // the authoritative card-country tier already). Unchanged semantics.
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const stripe = getStripe();
        const subscription = await withTimeout(
          stripe.subscriptions.retrieve(session.subscription as string),
          stripeTimeoutMs(),
          `stripe.subscriptions.retrieve(${session.subscription})`,
        );
        await withTimeout(
          handleSubscriptionCreated(subscription),
          handlerTimeoutMs(),
          'handleSubscriptionCreated',
        );
      }
      break;
    }
    case 'customer.subscription.updated':
      await withTimeout(
        handleSubscriptionUpdated(event.data.object as Stripe.Subscription),
        handlerTimeoutMs(),
        'handleSubscriptionUpdated',
      );
      break;

    case 'customer.subscription.deleted':
      await withTimeout(
        handleSubscriptionDeleted(event.data.object as Stripe.Subscription),
        handlerTimeoutMs(),
        'handleSubscriptionDeleted',
      );
      break;

    case 'invoice.payment_failed':
      await withTimeout(
        handleInvoicePaymentFailed(event.data.object as Stripe.Invoice),
        handlerTimeoutMs(),
        'handleInvoicePaymentFailed',
      );
      break;

    case 'invoice.payment_succeeded':
      await withTimeout(
        handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice),
        handlerTimeoutMs(),
        'handleInvoicePaymentSucceeded',
      );
      break;

    // Other event types: no side-effect. The job is still marked done so the
    // recovery sweep doesn't keep re-picking it.
  }
}

async function markJobDone(eventId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await withTimeout(
    supabase
      .from('stripe_processed_events')
      .update({ status: 'done', last_error: null, updated_at: new Date().toISOString() })
      .eq('event_id', eventId),
    supabaseTimeoutMs(),
    'markJobDone',
  );
}

async function markJobFailed(eventId: string, err: unknown): Promise<void> {
  const supabase = getSupabaseAdmin();
  const message = err instanceof Error ? err.message : String(err);
  // Best-effort read of current attempts so we can increment; on any hiccup we
  // still flip status to 'failed' (the sweep re-runs it regardless of count).
  let attempts = 1;
  try {
    const { data } = await withTimeout(
      supabase
        .from('stripe_processed_events')
        .select('attempts')
        .eq('event_id', eventId)
        .maybeSingle(),
      supabaseTimeoutMs(),
      'markJobFailed:readAttempts',
    );
    if (data && typeof (data as { attempts?: number }).attempts === 'number') {
      attempts = (data as { attempts: number }).attempts + 1;
    }
  } catch { /* fall back to attempts=1 */ }

  await withTimeout(
    supabase
      .from('stripe_processed_events')
      .update({
        status: 'failed',
        attempts,
        last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId),
    supabaseTimeoutMs(),
    'markJobFailed:update',
  );
}

/**
 * Process one claimed webhook event to completion. Fire-and-forget safe: this
 * NEVER rejects — every failure is recorded on the job row and logged, so an
 * unhandled rejection can't take down the process.
 *
 * @returns the terminal job status ('done' | 'failed') — used by tests and the
 *          recovery sweep; callers on the response path ignore it.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<'done' | 'failed'> {
  try {
    await applySideEffects(event);
    await markJobDone(event.id);
    logger.info(
      { event_id: event.id, event_type: event.type },
      'stripe-webhook: processed',
    );
    return 'done';
  } catch (err) {
    const timedOut = isTimeoutError(err);
    logger.error(
      {
        event_id: event.id,
        event_type: event.type,
        error: err instanceof Error ? err.message : String(err),
        timeout: timedOut,
        // This is a BUSINESS/PROCESSING failure, NOT a signature failure — the
        // route reserves the 400 "Invalid signature" label for real sig failures.
        error_class: 'processing',
      },
      'stripe-webhook: processing failed — job left releasable for retry',
    );
    try {
      await markJobFailed(event.id, err);
    } catch (markErr) {
      // If we can't even record the failure, log loudly; the stale-pending sweep
      // will still pick this row up (it never reached 'done').
      logger.error(
        {
          event_id: event.id,
          error: markErr instanceof Error ? markErr.message : String(markErr),
        },
        'stripe-webhook: FAILED to mark job failed (row stays pending → sweep will retry)',
      );
    }
    return 'failed';
  }
}

/**
 * Durability backstop. Re-processes releasable jobs from their stored payload:
 *   - status='failed' (a prior processing attempt errored/timed out), and
 *   - status='pending' older than the stale threshold (process restarted between
 *     ACK and completion, so processing never finished).
 *
 * Idempotent: handlers converge entitlement to the event's truth, and each job's
 * status gates re-application. Called by the cron scheduler.
 */
export async function recoverStuckWebhookJobs(limit = 25): Promise<{ recovered: number; failed: number }> {
  const supabase = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - stalePendingMs()).toISOString();

  // failed → always releasable; pending → only if stale.
  const { data: rows, error } = await supabase
    .from('stripe_processed_events')
    .select('event_id, event_type, status, payload, updated_at')
    .or(`status.eq.failed,and(status.eq.pending,updated_at.lt.${staleBefore})`)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'stripe-webhook recovery: query failed');
    return { recovered: 0, failed: 0 };
  }

  let recovered = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const r = row as { event_id: string; event_type: string; payload: Stripe.Event | null };
    if (!r.payload) {
      // No stored payload (e.g. a pre-hardening legacy row that somehow re-entered
      // this state) — we can't replay it without re-fetching from Stripe. Skip and
      // log; do not fabricate side-effects.
      logger.warn(
        { event_id: r.event_id, event_type: r.event_type },
        'stripe-webhook recovery: no stored payload, cannot replay — skipping',
      );
      continue;
    }
    const status = await processStripeEvent(r.payload);
    if (status === 'done') recovered++;
    else failed++;
  }

  if (recovered > 0 || failed > 0) {
    logger.info({ recovered, failed }, 'stripe-webhook recovery: sweep complete');
  }
  return { recovered, failed };
}
