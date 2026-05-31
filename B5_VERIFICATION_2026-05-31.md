# B5 — First-Build-Free Verification (2026-05-31)

Audit flagged uncertainty: are create-project / first-build gated behind a paid plan?

## Verdict: first build IS free. No improper gating.

Source: `apps/api/src/middleware/trial-gate.ts` (global `/api/*` middleware).

How a brand-new user's first actions resolve:

1. **Read access is never gated** — `GET /api/projects`, chats, files pass even after trial
   expiry (`READ_ONLY_GET_PREFIXES`, lines 24-52).
2. **BYOK is never gated** — `/api/byok-keys` skips the gate (line 41), so a user on their own
   key has no Goblin-side paywall at all.
3. **First gated action auto-starts a free 3-day trial and passes** — when a user with no
   `cloud_trial_started_at` hits a gated route (e.g. `POST /api/projects`, `POST /api/builds`,
   `POST /api/deploy`), the gate *starts* the trial and calls `next()` (lines 96-108). So the
   first create + first build + first deploy all succeed for free.
4. **Paid plans / active subs / comped users** pass unconditionally (lines 84-94).
5. Only **after** the 3-day trial expires does a gated write return `402 trial_expired`
   (lines 114-120).

So: create-project, first build, and first deploy are **free** within the auto-started trial.
No upfront payment wall on first use. ✅ No code change required to the gate.

## Recommended reassurance copy (ready-to-apply, not yet applied)

The audit recommended surfacing this to new users for trust. Kept out of this commit to avoid
a blind edit to the new-project UI under the 9/10 bar — apply with a quick visual check:

- **Where:** `apps/web/app/dashboard/new/page.tsx` (project-create screen), under the primary
  CTA, OR the empty-state of the first build action.
- **Copy (DE-first):** „Dein erster Build ist kostenlos – 3 Tage Goblin Cloud gratis, keine
  Karte nötig.“
- **Why deferred:** new-project page not opened this run; one-line insert + visual check is a
  trivial Sprint-3 follow-up.
