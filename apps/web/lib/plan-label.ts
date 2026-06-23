// FIX2-4 (BUG-15): one source of truth for the user-facing plan badge.
// The authoritative state is the server `users.plan` column (+ is_comped).
// Every surface (sidebar, settings, billing) must render this same label so
// the badge can never contradict itself.
const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  free: 'Trial',
  build: 'Build',
  pro: 'Pro',
  power: 'Power',
};

export function planLabel(plan?: string | null, isComped?: boolean, lang?: 'de' | 'en'): string {
  if (isComped) return lang === 'en' ? 'Full access' : 'Vollzugriff';
  const key = (plan ?? '').toLowerCase();
  if (PLAN_LABELS[key]) return PLAN_LABELS[key];
  if (!key) return 'Trial';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
