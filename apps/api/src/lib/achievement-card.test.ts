import { describe, it, expect } from 'vitest';
import { shouldShowAchievementCard } from './achievement-card';

const NOW = new Date('2026-07-10T12:00:00Z');
const future = new Date(NOW.getTime() + 86400000).toISOString();
const past = new Date(NOW.getTime() - 86400000).toISOString();

describe('shouldShowAchievementCard', () => {
  it('active trial, never shown → show', () => {
    expect(shouldShowAchievementCard({ plan: 'none', cloud_trial_ends_at: future, trial_consumed_at: null }, NOW)).toBe(true);
  });

  it('active trial, already shown → do not show (once per user)', () => {
    expect(shouldShowAchievementCard(
      { plan: 'none', cloud_trial_ends_at: future, trial_consumed_at: null, achievement_upgrade_card_seen_at: past },
      NOW,
    )).toBe(false);
  });

  it('expired trial → no show', () => {
    expect(shouldShowAchievementCard({ plan: 'none', cloud_trial_ends_at: past, trial_consumed_at: null }, NOW)).toBe(false);
  });

  it('paid subscriber → no show (trial-only)', () => {
    expect(shouldShowAchievementCard(
      { plan: 'pro', stripe_subscription_id: 'sub_x', trial_consumed_at: NOW.toISOString(), cloud_trial_ends_at: future },
      NOW,
    )).toBe(false);
  });

  it('comped → no show', () => {
    expect(shouldShowAchievementCard({ plan: 'build', is_comped: true }, NOW)).toBe(false);
  });
});
