import { Hono } from 'hono';
import Stripe from 'stripe';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  createCheckoutSession,
  createPortalSession,
  createSetupIntent,
  resolveCheckoutPrice,
  createSubscriptionAtTier,
  previewPlanChange,
  changePlan,
} from '../services/billing-service';
import { processStripeEvent } from '../services/stripe-webhook-processor';
import { getSupabaseAdmin } from '../lib/supabase';
import { trackEvent } from '../lib/platform-events';
import { derivePlanTruth } from '../lib/plan-truth';
import { getGeoTier, PLAN_PRICES, TIER_LABELS } from '../config/geo-pricing';
import logger from '../lib/logger';
import { withTimeout, envTimeoutMs } from '../lib/with-timeout';

// Pre-ACK claim-phase timeout (env-overridable). Kept short: the idempotency
// check + claim are the only Supabase writes on the response path, and a stalled
// one must not delay the 200 ACK to Stripe.
const WEBHOOK_CLAIM_TIMEOUT_MS = () => envTimeoutMs('STRIPE_WEBHOOK_CLAIM_TIMEOUT_MS', 5_000);

type Variables = { userId: string }
const billing = new Hono<{ Variables: Variables }>();

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
}

billing.post('/create-checkout-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    targetPlan: z.enum(['build', 'pro', 'power']),
    countryCode: z.string().length(2).optional(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid plan' }, 400);

  // Detect country from Cloudflare header (most reliable), fallback to client-provided
  const cfCountry = c.req.header('CF-IPCountry');
  const countryCode = cfCountry ?? result.data.countryCode ?? null;

  const checkoutUrl = await createCheckoutSession(userId, result.data.targetPlan, countryCode);
  // I1 funnel: upgrade_clicked — a real checkout session was created (server-side
  // intent to pay), distinct from `upgraded` which fires from the Stripe webhook
  // truth. Metadata only (which plan). Fire-and-forget.
  trackEvent({ eventType: 'upgrade_clicked', userId, meta: { target_plan: result.data.targetPlan } });
  return c.json({ checkoutUrl });
});

// ──────────────────────────────────────────────────────────────────────────
// Elements / SetupIntent flow (2026-06-23). Three steps: create a SetupIntent
// → resolve the card-country price → create the subscription at that price.
// ──────────────────────────────────────────────────────────────────────────

// POST /api/billing/setup-intent — start card collection (no charge yet).
billing.post('/setup-intent', authMiddleware, async (c) => {
  const userId = c.get('userId');
  try {
    const { clientSecret, customerId } = await createSetupIntent(userId);
    return c.json({ clientSecret, customerId });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Setup failed' }, 500);
  }
});

// POST /api/billing/resolve-price — read the card BIN country, return the
// authoritative price the pay button must show. Pure read, never charges.
billing.post('/resolve-price', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    targetPlan: z.enum(['build', 'pro', 'power']),
    paymentMethodId: z.string().min(1),
    countryCode: z.string().length(2).optional(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  const ipCountry = c.req.header('CF-IPCountry') ?? result.data.countryCode ?? null;
  try {
    const resolved = await resolveCheckoutPrice(
      result.data.targetPlan,
      result.data.paymentMethodId,
      ipCountry,
    );
    return c.json(resolved);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Resolve failed' }, 500);
  }
});

// POST /api/billing/create-subscription — create the subscription at the
// authoritative tier, but only if the client-confirmed price still matches the
// re-resolved one (never charge more than was shown). Returns 409 + the new
// price when a re-confirm is needed.
billing.post('/create-subscription', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    targetPlan: z.enum(['build', 'pro', 'power']),
    paymentMethodId: z.string().min(1),
    confirmedPriceId: z.string().min(1),
    countryCode: z.string().length(2).optional(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  const ipCountry = c.req.header('CF-IPCountry') ?? result.data.countryCode ?? null;
  try {
    const r = await createSubscriptionAtTier(
      userId,
      result.data.targetPlan,
      result.data.paymentMethodId,
      ipCountry,
      result.data.confirmedPriceId,
    );
    if (!r.ok) return c.json(r, 409); // price drifted → client must re-confirm
    return c.json(r);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Subscription failed' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Change plan for an EXISTING subscriber — subscriptions.update (NOT a second
// create). Two steps: preview the prorated amount, then apply at the previewed
// price. No card re-entry, no new SetupIntent, no tier re-resolution.
// ──────────────────────────────────────────────────────────────────────────

// POST /api/billing/change-plan-preview — prorated amount due now (or credited)
// for switching to targetPlan. Pure read (upcoming-invoice preview), no charge.
billing.post('/change-plan-preview', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ targetPlan: z.enum(['build', 'pro', 'power']) });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid plan' }, 400);

  try {
    const preview = await previewPlanChange(userId, result.data.targetPlan);
    if (!preview.hasActiveSubscription) {
      // No live sub → caller should use the subscribe path, not change-plan.
      return c.json({ hasActiveSubscription: false }, 409);
    }
    return c.json(preview);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Preview failed' }, 500);
  }
});

// POST /api/billing/change-plan — apply the switch on the existing subscription
// at the previewed price. 409 if the price drifted (re-confirm) or no live sub.
billing.post('/change-plan', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    targetPlan: z.enum(['build', 'pro', 'power']),
    confirmedPriceId: z.string().min(1),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  try {
    const r = await changePlan(userId, result.data.targetPlan, result.data.confirmedPriceId);
    if (!r.ok) return c.json(r, 409); // price drifted or no active sub
    return c.json(r);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Plan change failed' }, 500);
  }
});

// GET /api/billing/geo-pricing — returns tier + prices for current user's region
billing.get('/geo-pricing', async (c) => {
  const cfCountry = c.req.header('CF-IPCountry') ?? null;
  const tier = getGeoTier(cfCountry);
  return c.json({
    tier,
    country: cfCountry,
    label: TIER_LABELS[tier],
    prices: {
      build: PLAN_PRICES.build[tier],
      pro:   PLAN_PRICES.pro[tier],
      power: PLAN_PRICES.power[tier],
    },
  });
});

billing.post('/create-portal-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  try {
    const portalUrl = await createPortalSession(userId);
    return c.json({ portalUrl });
  } catch (e) {
    // Common cause in a freshly-live account: the Stripe Customer Portal has not
    // been configured/published in the Dashboard (Billing → Customer portal) for
    // this mode, so billingPortal.sessions.create throws. Surface it instead of a
    // silently-dead "Abo verwalten" button.
    const message = e instanceof Error ? e.message : 'Portal unavailable';
    return c.json({ error: message }, 500);
  }
});

// GET /api/billing/status — unified billing state for the BillingPage
billing.get('/status', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  // Source of truth for the current plan is `users.plan` (written by
  // handleSubscriptionCreated on every subscription create/update). There is no
  // `subscription_status` or `trial_ends_at` column (neither exists in any
  // migration) — selecting them made `.single()` error and /status 404 for every
  // user, which is why a completed subscription never reflected in the UI.
  const { data: user, error } = await supabase
    .from('users')
    .select('plan, subscription_current_period_end, cloud_trial_ends_at, is_comped, comp_reason, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, trial_consumed_at, payment_state, next_payment_attempt')
    .eq('id', userId)
    .single();

  if (error || !user) return c.json({ error: 'User not found' }, 404);

  // Derived entitlement — 'plan' returned here must be the real current plan, not
  // the raw column (a default/cancelled user resolves to 'none' → paywall).
  const truth = derivePlanTruth(user);

  // F-32: server-side "purchase confirmation seen" flag. Read in a SEPARATE best-effort
  // query so a pre-migration DB (column absent, migration 0093) can NEVER break /status
  // — exactly the failure the fixed select above warns about. `lastConfirmedPlan` stays
  // null and `planConfirmationServer` false when the column is dark; the web component
  // then falls back to its device-local localStorage, preserving today's behavior.
  let lastConfirmedPlan: string | null = null;
  let planConfirmationServer = false;
  try {
    const { data: flagRow, error: flagErr } = await supabase
      .from('users').select('last_confirmed_plan').eq('id', userId).single();
    if (!flagErr && flagRow) {
      lastConfirmedPlan = (flagRow as { last_confirmed_plan: string | null }).last_confirmed_plan ?? null;
      planConfirmationServer = true;
    }
  } catch { /* column absent pre-migration → client uses localStorage fallback */ }

  // Card info (best-effort, don't fail status if Stripe is down)
  let cardLast4: string | null = null;
  let cardBrand: string | null = null;
  if (user.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
        expand: ['invoice_settings.default_payment_method'],
      }) as Stripe.Customer;
      const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
      if (pm?.card) {
        cardLast4 = pm.card.last4;
        cardBrand = pm.card.brand;
      }
    } catch { /* silent */ }
  }

  return c.json({
    plan: truth.planKey,
    planState: truth.state,
    status: null,
    // Only surface trialEndsAt when the derived state is actually a trial — a paid
    // (or cancelled-but-still-paid) account must never render "Trial endet …" just
    // because an old cloud_trial_ends_at lingers on the row.
    trialEndsAt: truth.state === 'trial' ? (user.cloud_trial_ends_at ?? null) : null,
    currentPeriodEnd: user.subscription_current_period_end ?? null,
    // Cancel-at-period-end → paid until this date; UI shows "Pro — läuft aus am …".
    cancelAtPeriodEnd: truth.cancelAtPeriodEnd,
    endsAt: truth.endsAt,
    // Dunning: a failing renewal keeps state 'paid' (access retained) but flags this
    // so the web shows the "update your payment method" banner until recovery.
    paymentFailing: truth.paymentFailing,
    paymentDeadline: truth.paymentDeadline,
    cardLast4,
    cardBrand,
    isComped: !!user.is_comped,
    compReason: user.comp_reason ?? null,
    // F-32: the resolved plan key already seen/celebrated on this account (server-side,
    // cross-device). `planConfirmationServer` tells the client whether the server flag
    // is live yet — when false it falls back to localStorage.
    lastConfirmedPlan,
    planConfirmationServer,
  });
});

// POST /api/billing/confirm-plan — F-32: mark the current plan's purchase confirmation
// as seen for this user (server-side, so it doesn't re-fire on another device). Reads
// the plan truth server-side (never trusts a client-supplied plan) and stores the
// resolved planKey. Tolerant: a pre-migration DB (column 0093 absent) returns
// {ok:false, reason:'flag_unavailable'} — NOT a 500 — so the client keeps its
// localStorage fallback and the celebration is never falsely reported as persisted.
billing.post('/confirm-plan', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from('users')
    .select('plan, subscription_current_period_end, cloud_trial_ends_at, is_comped, comp_reason, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, trial_consumed_at, payment_state, next_payment_attempt')
    .eq('id', userId)
    .single();
  if (error || !user) return c.json({ error: 'User not found' }, 404);

  const planKey = derivePlanTruth(user).planKey;
  try {
    const { error: updErr } = await supabase
      .from('users').update({ last_confirmed_plan: planKey }).eq('id', userId);
    if (updErr) return c.json({ ok: false, reason: 'flag_unavailable' });
    return c.json({ ok: true, plan: planKey });
  } catch {
    return c.json({ ok: false, reason: 'flag_unavailable' });
  }
});

// GET /api/billing/invoices — last 12 Stripe invoices
billing.get('/invoices', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user?.stripe_customer_id) {
    return c.json({ invoices: [] });
  }

  try {
    const cursor = c.req.query('cursor') || undefined;
    const invoices = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 12,
      ...(cursor ? { starting_after: cursor } : {}),
    });

    const formatted = invoices.data.map(inv => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      pdf_url: inv.invoice_pdf,
      hosted_url: inv.hosted_invoice_url,
    }));

    return c.json({
      invoices: formatted,
      has_more: invoices.has_more,
      next_cursor: invoices.has_more && formatted.length > 0 ? (formatted.at(-1)?.id ?? null) : null,
    });
  } catch {
    return c.json({ invoices: [], has_more: false, next_cursor: null });
  }
});

// GET /api/billing/payment-method — current card info
billing.get('/payment-method', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user?.stripe_customer_id) {
    return c.json({ payment_method: null });
  }

  try {
    const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    }) as Stripe.Customer;

    const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
    if (!pm || !pm.card) {
      return c.json({ payment_method: null });
    }

    return c.json({
      payment_method: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      }
    });
  } catch {
    return c.json({ payment_method: null });
  }
});

// GET /api/billing/usage — activity breakdown for the current calendar month.
// DD §A: reads the canonical `agent_runs` table (the same source the usage screen
// uses), NOT the retired `monthly_requests_used` counter. `used` is the real BUILD
// count this month; there is no legacy request `limit` (the only limit is the
// weighted Goblin allowance surfaced on the usage screen / GoblinUsageBar).
billing.get('/usage', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, subscription_current_period_end')
    .eq('id', userId)
    .single();

  if (!user) return c.json({ error: 'User not found' }, 404);

  // Build count by source tier for the current calendar month.
  let byok_count = 0;
  let free_count = 0;
  let hosted_count = 0;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: runs } = await supabase
      .from('agent_runs')
      .select('source_tier')
      .eq('user_id', userId)
      .eq('status', 'success')
      .gte('created_at', startOfMonth);

    for (const r of runs ?? []) {
      const t = (r as { source_tier?: string }).source_tier;
      if (t === 'byok') byok_count++;
      else if (t === 'free_api') free_count++;
      else if (t === 'goblin_hosted') hosted_count++;
    }
  } catch {
    // Best-effort breakdown — on any read failure show zero, never a frozen counter.
  }

  return c.json({
    plan: user.plan,
    used: byok_count + free_count + hosted_count,
    reset_date: user.subscription_current_period_end,
    breakdown: {
      byok: byok_count,
      free_api: free_count,
      goblin_hosted: hosted_count,
    },
  });
});

billing.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature')!;
  const body = await c.req.text();

  // ── Phase 1: signature verify (the ONLY path that returns 400) ─────────────
  // WH3: a 400 "Invalid signature" is reserved STRICTLY for a real signature
  // failure. Business/processing errors never reach this label — they surface
  // async on the job row (WH1) or as a 500 during the pre-ACK claim below.
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (sigErr) {
    logger.warn(
      { error: sigErr instanceof Error ? sigErr.message : String(sigErr), error_class: 'signature' },
      'stripe-webhook: signature verification failed',
    );
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // ── Phase 2: idempotency + durable claim (pre-ACK) ─────────────────────────
  // Store the raw payload so a background/recovery run can re-apply the side
  // effects without a stalled upstream on the response path. A failure to even
  // reach the idempotency table here is an INFRA error before we've ACKed → 500
  // so Stripe retries (this is the "business/infra error → 500 class", never a
  // mislabelled 400). Signature success is already proven at this point.
  const supabase = getSupabaseAdmin();
  try {
    const { data: existing } = await withTimeout(
      supabase
        .from('stripe_processed_events')
        .select('event_id')
        .eq('event_id', event.id)
        .maybeSingle(),
      WEBHOOK_CLAIM_TIMEOUT_MS(),
      'webhook:idempotencyCheck',
    );
    if (existing) {
      // Duplicate delivery — the first delivery already claimed this event (it
      // may still be processing). Idempotency short-circuit: no-op 200.
      return c.json({ received: true, duplicate: true });
    }

    // Claim the event durably (status='pending', payload stored) BEFORE ACKing.
    // The unique-pk constraint makes a concurrent duplicate delivery lose the
    // race (its insert errors → caught below → we treat it as a duplicate).
    const { error: claimErr } = await withTimeout(
      supabase
        .from('stripe_processed_events')
        .insert({
          event_id: event.id,
          event_type: event.type,
          status: 'pending',
          payload: event as unknown as Record<string, unknown>,
        }),
      WEBHOOK_CLAIM_TIMEOUT_MS(),
      'webhook:claim',
    );
    if (claimErr) {
      // Most likely a duplicate delivery racing us (unique-pk conflict) → the
      // other delivery owns processing, so this is a safe no-op 200.
      logger.info(
        { event_id: event.id, event_type: event.type, error: claimErr.message },
        'stripe-webhook: claim conflict (concurrent duplicate) — no-op',
      );
      return c.json({ received: true, duplicate: true });
    }
  } catch (claimInfraErr) {
    // Could not reach the idempotency table (Supabase down / timed out) BEFORE we
    // ACKed. Return 500 so Stripe retries the delivery — NOT a 400. Nothing was
    // claimed, so the retry re-runs cleanly.
    logger.error(
      {
        event_id: event.id,
        event_type: event.type,
        error: claimInfraErr instanceof Error ? claimInfraErr.message : String(claimInfraErr),
        error_class: 'infra',
      },
      'stripe-webhook: claim phase failed before ACK — returning 500 for Stripe retry',
    );
    return c.json({ error: 'Webhook claim failed, retry' }, 500);
  }

  // ── Phase 3: ACK fast, work async (WH1) ────────────────────────────────────
  // Side-effects run in a background continuation with per-call timeouts (WH2).
  // Railway keeps this Node process alive, so the fire-and-forget promise runs to
  // completion; if the process is restarted mid-flight, the job stays 'pending'
  // and recoverStuckWebhookJobs() (cron) re-applies it from the stored payload.
  // processStripeEvent NEVER rejects (it records failure on the job row), so this
  // is safe to leave un-awaited.
  void processStripeEvent(event);

  return c.json({ received: true });
});

export { billing };
