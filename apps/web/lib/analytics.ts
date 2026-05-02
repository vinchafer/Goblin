// PostHog analytics — NEVER track chat content, code, API keys, file content
// posthog-js is an optional peer dep — imported dynamically so the app builds without it

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ph: any = null;

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (_ph) return;

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') return;

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
