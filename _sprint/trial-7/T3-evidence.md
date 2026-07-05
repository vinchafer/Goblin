# T3 — Expiry honesty check

## Diagnosis — what actually happens at day-8 and at budget exhaustion

**At trial expiry (day 8).** `derivePlanTruth` flips to `none` (no access). The trial
gate (`trial-gate.ts`) then:
- **Allows** all `GET` on read-only resources (projects, files, code) — F9a fix. The user
  can still view and **download** their code.
- **402s** write/paid actions (model calls, build, deploy) → the web shell redirects to
  `/dashboard/trial-gate` (expired variant).
- BYOK paths are never gated; **GitHub push still works**.

**Data & deployed-app retention (verified).** `teardownVercelProject` is called from
**exactly one place** — `routes/projects.ts` on explicit project **delete**
(`teardown-on-delete.test.ts`). There is **no** cron/expiry caller. So at trial expiry:
projects, code and **already-published Vercel apps stay — and stay online**. Nothing is
deleted or torn down. (Only deleting the project removes its deployment.)

**At budget/allowance exhaustion.** `model-router.ts` `allowanceReachedMsg` /
`dailyGuardMsg` are **already bilingual and honest** (DE+EN, no raw numbers, reset date +
upgrade/BYOK path). `soft-limits.ts` daily block reason is German-only but is a legacy
free-pool guard, not the trial path. **No change needed** — budget messaging is honest.

## Honesty problems found (copy/messaging only) → fixed

1. **Expired trial-gate screen was vague.** `/dashboard/trial-gate` (expired) said only
   "Deine Testphase ist beendet / Schließe ein Abo ab…" — it never told the user what
   happens to their work. A user could reasonably fear their projects/deployed app were
   gone. **Fix:** added a specific, verified reassurance line (DE+EN):
   *"Deine Projekte und bereits veröffentlichten Apps bleiben erhalten und online. Du
   kannst dich weiterhin anmelden, deinen Code herunterladen und zu GitHub pushen. Mit
   einem Abo arbeitest du sofort weiter."* — every clause traces to real behaviour above.

2. **Trial-gate 402 API message was English-only** (`Your free trial has ended…`) — a
   leak for DE users if the raw message ever surfaces (fallback when the shell doesn't
   redirect). **Fix:** localized via `preferred_lang` (DE/EN), and the expired variant now
   also states projects/apps are safe.

### Before → after
- Gate screen (expired), added line — see `T3-expired-gate-render.html` (render captured).
- API 402 `message`: English-only → `preferred_lang`-aware DE/EN, retention-honest.

## Behavioural changes: NONE (flagged, not built)
Only copy/messaging changed. No gate logic, no retention logic, no teardown wiring touched.

## Gate
- `tsc --noEmit`: **API clean, web clean.**
- Existing `17-magic-link-byok-trial.spec.ts` already covers expired→402 behaviour
  (unchanged). A live expired-trial capture needs DB date manipulation on the shared
  Supabase — not run here (no prod DB mutation); the copy is verified by render + tsc.

## For the founder
- **Verified truth to stand behind:** at trial expiry NOTHING is deleted — projects, code
  and published apps persist and **deployed apps stay online**; only new paid actions are
  gated; read/download/GitHub-push remain open. The new copy promises exactly this and no
  more. Safe to repeat in marketing.
- No Stripe trial-length setting exists to change (trial is Goblin-side gating).
