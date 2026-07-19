import { createMiddleware } from 'hono/factory';
import { getSupabaseAdmin } from '../lib/supabase';
import { derivePlanTruth } from '../lib/plan-truth';
import { withCompExpiry } from '../lib/comp-expiry';

export const TRIAL_DAYS = 7;

/** Single authoritative trial-window computation: start + TRIAL_DAYS. Pure, for testing. */
export function trialEndFrom(now: Date): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 86400000);
}

// Paths that skip the trial gate entirely (public routes, webhooks, OAuth callbacks)
const SKIP_PATHS = [
  '/api/billing/webhook',
  '/api/billing',
  '/api/users',
  '/health',
  '/version',
  // Onboarding completion save MUST work before a user can reach the trial gate.
  // Without this, PUT /api/onboarding/state 402'd for every no-sub/no-trial user,
  // the completion flag never persisted, and the dashboard guard bounced them
  // back into /welcome — an inescapable onboarding loop. Costs Goblin nothing (no
  // AI). NOTE: precise path, NOT '/api/onboarding' — that would also exempt the
  // billable '/api/onboarding-agent' setup-buddy stream, which must stay gated.
  '/api/onboarding/state',
  '/api/github/callback',
  '/api/templates',
  '/api/rankings',
  '/api/account',
  // Promo redemption is how a no-plan user GETS a plan — it must never be paywalled,
  // and it costs Goblin nothing (no AI). Mirrors '/api/account/redeem-invite'.
  '/api/promo',
  '/api/auth',
  '/api/shared',
  '/api/investor', // investor-gated, server-to-server; has its own shared-secret auth
];

// Read-only paths that should remain accessible even after trial expiry.
// Users must be able to *view* their projects and chats; only AI-billing
// actions are blocked behind the paywall.
const READ_ONLY_GET_PREFIXES = [
  '/api/projects',
  '/api/chat-sessions',
  '/api/chats',
  '/api/files',
];

// Check if request is BYOK-backed (no trial cost to Goblin)
function isByokPath(path: string): boolean {
  return path.startsWith('/api/byok-keys');
}

export const trialGate = createMiddleware(async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  // Skip non-gated paths
  if (SKIP_PATHS.some(p => path.startsWith(p)) || isByokPath(path)) {
    return next();
  }

  // Allow GET on read-only resources after trial expiry — F9a: users with
  // expired trial were seeing "Failed to load projects" because this gate
  // returned 402 on the projects list fetch. Read access never costs Goblin
  // anything; only paid-feature actions (model calls, build, etc.) should
  // hit the paywall.
  if (method === 'GET' && READ_ONLY_GET_PREFIXES.some(p => path.startsWith(p))) {
    return next();
  }

  // Resolve userId — defense-in-depth: always validate from token when not pre-set.
  // Never skip trial check just because the Authorization header is absent — that would
  // allow unauthenticated requests to bypass trial gating if a future route forgets
  // authMiddleware. Per-route auth will reject unauthorized requests afterward anyway.
  let userId = c.get('userId') as string | undefined;
  if (!userId) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      // No auth token present — block this request from reaching any paid feature.
      // The per-route authMiddleware will return a cleaner 401, but we must not let
      // it slide through the trial gate as if it were a free pass.
      return next();
    }
    const token = authHeader.substring(7);
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(); // invalid token — per-route auth rejects
    userId = user.id;
  }

  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id, cloud_trial_started_at, cloud_trial_ends_at, trial_extension_used, is_comped, preferred_lang')
    .eq('id', userId)
    .single();

  if (!user) return next();

  // Canonical entitlement (comped | paid | active-trial) — derived, never the raw
  // `plan` column. 'build'-default users no longer pass (the old PAID_PLANS check
  // counted 'build' and let every default user bypass the gate forever).
  // A comped user gets a best-effort comped_until read (only for is_comped rows, and
  // pre-migration tolerant) so an EXPIRED promo degrades to the paywall here too.
  const userWithExpiry = await withCompExpiry(supabase, userId, user);
  const truth = derivePlanTruth(userWithExpiry);
  if (truth.hasAccess) return next();

  // No access. The user must ACTIVELY choose a trial or subscribe (no silent
  // auto-start anymore). Distinguish never-started vs expired for the message;
  // the web gate (dashboard-shell) redirects to /dashboard/trial-gate on 402.
  const started = !!user.cloud_trial_started_at;
  // TRIAL-7 T3: localize the gate message (was English-only — a leak for DE users).
  // The expired copy is also specific about what survives: nothing is deleted.
  const de = user.preferred_lang === 'de';
  const message = started
    ? (de
        ? 'Deine kostenlose Testphase ist beendet. Deine Projekte und veröffentlichten Apps bleiben erhalten — schließe ein Abo ab, um weiterzuarbeiten.'
        : 'Your free trial has ended. Your projects and published apps are safe — subscribe to keep working.')
    : (de
        ? 'Wähle deine kostenlose Testphase oder ein Abo, um Goblin Cloud zu nutzen.'
        : 'Choose your free trial or a subscription to start using Goblin Cloud.');
  return c.json({
    error: started ? 'trial_expired' : 'trial_required',
    message,
    upgradeUrl: '/dashboard/upgrade',
    gateUrl: '/dashboard/trial-gate',
    code: started ? 'trial_expired' : 'trial_required',
  }, 402);
});

// Start the free trial — the ACTIVE choice from the gate screen. Idempotent: if a
// trial was already started it is NOT reset (no farming a fresh window). Returns the
// trial end so the caller can show the countdown immediately.
export async function startTrial(
  userId: string,
): Promise<{ success: boolean; endsAt: string | null; alreadyStarted: boolean }> {
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('cloud_trial_started_at, cloud_trial_ends_at, is_comped, stripe_subscription_id')
    .eq('id', userId)
    .single();

  if (!user) return { success: false, endsAt: null, alreadyStarted: false };

  // Already started (or already entitled) → don't reset the window.
  if (user.cloud_trial_started_at) {
    return { success: true, endsAt: (user.cloud_trial_ends_at as string) ?? null, alreadyStarted: true };
  }

  const now = new Date();
  const trialEnd = trialEndFrom(now);
  await supabase
    .from('users')
    .update({
      cloud_trial_started_at: now.toISOString(),
      cloud_trial_ends_at: trialEnd.toISOString(),
    })
    .eq('id', userId);

  return { success: true, endsAt: trialEnd.toISOString(), alreadyStarted: false };
}

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
