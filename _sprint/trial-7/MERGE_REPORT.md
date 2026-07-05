# TRIAL-7 — Merge Report

**Merged to master:** `0ce3237` (`--no-ff`, from `trial-7-2026-07-07`, rebased clean on `de09e87`).
**Deployed & verified:**
- API (Railway) `/version` gitCommit = `0ce3237bf39438acc92fd4bf7d20cc018ea96b7e` ✓
- Web (Vercel): `/api/version` redirects (not a SHA source — prior memory stale), so verified
  H2-style by content: `justgoblin.com/` serves **"7-day free trial" ×4 / "7 days free" ×2, zero "3-day"** ✓

## Units
| Unit | Commit | What |
|------|--------|------|
| T1 | `4be9c2b` | Trial 3→7 days at the single source (`TRIAL_DAYS`), extracted `trialEndFrom()`; all DE/EN copy swept |
| T2 | `8f7c0d3` | Achievement upgrade card, once-per-user, server-flagged; slot+toast; honest copy |
| T3 | `5026c27` | Honest expiry messaging: retention-specific gate copy + localized 402 |

## Gates
- **Suites:** 362 API tests green (`vitest run`, 39 files); tsc clean web + api.
- **Evidence:** `_sprint/trial-7/T1-evidence.md`, `T2-evidence.md`, `T3-evidence.md`, render harnesses
  `T2-card-render-harness.html`, `T3-expired-gate-render.html`.
- **Consumption untouched (diffstat proof):** no files under `prompts/`, `model-router`,
  `project-context`/`state`, or ledger. Cap/margin/price numbers unchanged (4.9M cap, 1.65M daily
  guard, allowances all intact). goblin-cap only had "3 days"→"7 days" comment/test-description edits.

## ⚠ Founder action required
1. **Apply migration `0079_achievement_upgrade_card.sql`** in the Supabase SQL Editor (same batch as
   the still-pending 0077/0078). Until then the achievement card is **inert** (the client's GET is
   `.catch`-guarded → no card, no error surfaced). The **7-day trial is already fully live** — it
   needs no migration.
2. **Run T2 E2E** `tests/e2e/33-achievement-upgrade-card.spec.ts` after 0079 is applied (it asserts
   the once/trial-only/dismiss-persist server contract). It was authored but not run — the shared
   Supabase can't get the column until you apply it, and I don't self-apply migrations.

## T3 findings — the verified truth about expiry & retention
At trial expiry (day 8) **nothing is deleted**: projects, code, and **already-published Vercel apps
stay online** (teardown fires only on explicit project *delete* — `routes/projects.ts` — never on
expiry; no cron caller exists). Read/download and GitHub push remain open; only new paid actions
(model calls, build, deploy) are gated → redirect to `/dashboard/trial-gate`. The new copy promises
exactly this and nothing more — safe to repeat in marketing. Budget/allowance-exhaustion messaging
was already bilingual + honest (`model-router.ts`), so it was left untouched.

## Stripe
No Stripe trial-length setting exists to change — the trial is Goblin-side gating, pre-subscription.
Nothing to flag on Stripe.

## Non-changes worth noting
- Dropped the spec's suggested card line "mehr Projekte": projects are **unlimited on every plan**, so
  it would have been a false claim. Card says "mehr Einheiten pro Monat" (33→116 builds, true) and
  "dein Zugang endet nicht" (paid access doesn't expire, true). No price in-card (plan page carries $11).
- Trial extension mechanism (+2 days, one-time) left intact; banner denominator updated 3/5 → 7/9.
