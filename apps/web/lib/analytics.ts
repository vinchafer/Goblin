// PostHog analytics — NEVER track chat content, code, API keys, file content
// posthog-js is an optional peer dep — imported dynamically so the app builds without it

import { isDemoActive } from '@/lib/demo/demo-flag';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ph: any = null;

// Honesty sprint (F5): the Datenschutz "Anonyme Nutzungsdaten" opt-out used to
// write `goblin-tracking-opt-out` and nothing read it — an inert privacy control
// over a product that DOES run PostHog. This is the reader: opting out blocks
// init entirely, and `setAnalyticsOptOut` flips a live session too.
const OPT_OUT_KEY = 'goblin-tracking-opt-out';

function isOptedOut(): boolean {
  try { return localStorage.getItem(OPT_OUT_KEY) === 'true'; } catch { return false; }
}

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  // Demo routes fire no analytics — not even a pageview (Sprint 10 §6/§7).
  if (isDemoActive()) return;
  if (_ph) return;

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') return;
  // Respect the user's Datenschutz opt-out.
  if (isOptedOut()) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
  if (!key) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import('posthog-js') as Promise<any>).then(({ default: posthog }: { default: any }) => {
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      persistence: 'localStorage+cookie',
    });
    _ph = posthog;
  }).catch(() => {}); // posthog-js optional
}

export function identifyUser(userId: string, props: { email?: string; plan?: string; created_at?: string }): void {
  if (!_ph) return;
  _ph.identify(userId, {
    email: props.email,
    plan: props.plan,
    created_at: props.created_at,
  });
}

export function resetAnalyticsUser(): void {
  _ph?.reset();
}

// Live opt-out toggle for the Datenschutz setting. Persists the flag and applies
// it to the current session: opting out stops capturing immediately (and inits
// nothing if analytics wasn't loaded yet); opting back in resumes + (re)inits.
export function setAnalyticsOptOut(optOut: boolean): void {
  try { localStorage.setItem(OPT_OUT_KEY, optOut ? 'true' : 'false'); } catch { /* ignore */ }
  if (optOut) {
    _ph?.opt_out_capturing?.();
  } else {
    if (_ph) _ph.opt_in_capturing?.();
    else initAnalytics();
  }
}

// ─── Tracked events (only business-critical signals) ─────────────────────────

export function trackProjectCreated(props: { has_description: boolean; color: string }): void {
  _ph?.capture('project_created', props);
}

export function trackChatMessageSent(props: {
  model_provider: string;
  source_tier: string;
  has_code_block: boolean;
}): void {
  _ph?.capture('chat_message_sent', props);
}

export function trackSendToCodeClicked(props: { block_count: number; file_detected: boolean }): void {
  _ph?.capture('send_to_code_clicked', props);
}

export function trackGithubPushCompleted(props: { new_repo: boolean }): void {
  _ph?.capture('github_push_completed', props);
}

export function trackDeployCompleted(props: { platform: string; duration_ms: number }): void {
  _ph?.capture('deploy_completed', props);
}

export function trackByokKeyAdded(props: { provider: string }): void {
  _ph?.capture('byok_key_added', props);
}

export function trackOnboardingCompleted(props: { skipped: boolean }): void {
  _ph?.capture('onboarding_completed', props);
}

export function trackPlanUpgradeClicked(props: { from_plan: string; to_plan: string }): void {
  _ph?.capture('plan_upgrade_clicked', props);
}
