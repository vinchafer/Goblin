// TRIAL-7 T2 — the achievement-triggered upgrade card is shown exactly once per
// user, and only to a user who is currently on the trial (the conversion moment).
// Truth is server-side: `achievement_upgrade_card_seen_at` (NULL = never shown) plus
// the DERIVED plan state (a trial user's raw `plan` column is 'none', so we route
// through derivePlanTruth, the single authoritative entitlement source).

import { derivePlanTruth, type PlanTruthRow } from './plan-truth';

export interface AchievementCardRow extends PlanTruthRow {
  achievement_upgrade_card_seen_at?: string | null;
}

/**
 * Should the achievement upgrade card be shown right now?
 * Only when (a) the user is on an active trial AND (b) it has never been shown.
 * Once shown (dismiss or CTA), the flag is stamped and this returns false forever.
 */
export function shouldShowAchievementCard(row: AchievementCardRow, now?: Date): boolean {
  if (row.achievement_upgrade_card_seen_at) return false;
  return derivePlanTruth(row, now).state === 'trial';
}
