# T1 — Trial duration 3 → 7 days

## Diagnosis
Trial length is enforced in **one authoritative place**: `apps/api/src/middleware/trial-gate.ts`,
the `TRIAL_DAYS` constant. `startTrial()` stamps `cloud_trial_ends_at = now + TRIAL_DAYS*86400000`
onto the `users` row (the trial is an *active choice* from the gate, not auto-started at signup).
`derivePlanTruth` (`plan-truth.ts`) only *reads* `cloud_trial_ends_at` — it never recomputes a
duration. No DB migration sets a trial default (`0030_cloud_trial.sql` just adds nullable columns),
and Stripe carries **no trial length** (trial is Goblin-side gating, pre-subscription). So the single
change point is `TRIAL_DAYS`. Extension mechanism (`extendTrial`, +2 days one-time) is orthogonal and
unchanged; banner denominator updated 5→9 to match (7 base + 2 extension).

## Change
- `TRIAL_DAYS = 3 → 7`; extracted pure `trialEndFrom(now)` helper (single source, testable).
- Copy sweep (DE + EN), all runtime source occurrences 3 → 7:
  - `apps/api/src/services/support-knowledge.ts` (×3: pricing line, FAQ, error-code)
  - `apps/web/app/dashboard/trial-gate/page.tsx` (CTA)
  - `apps/web/app/dashboard/new/page.tsx` (first-build hint)
  - `apps/web/components/billing/geo-pricing-section.tsx`
  - `apps/web/components/landing/{faq.tsx, sections/Faq.tsx, sections/Pricing.tsx, sections/Hero.tsx}`
  - `apps/web/components/app-shell/trial-banner.tsx` (`Tag X von 7` / `von 9` w/ extension)
- Comments/tests referencing "3 days" cap-reachability updated to 7 (no cap/margin numbers changed;
  cap still binds at 4.9M, daily guard 1.65M unchanged).

## Gate evidence
- Unit test `apps/api/src/middleware/trial-gate.test.ts`: TRIAL_DAYS=7, 7-day window,
  boundary (day 7 active / day 8 expired). PASS.
- `vitest run` trial-gate + goblin-cap + plan-truth: **45 passed**.
- String sweep: `grep -i '3[ -]day|3 Tage|Your 3-day' apps/**/*.{ts,tsx}` → **No matches** (old absent).
  New present verified in files above. Built bundles re-grepped at final/merge (H2-style).
