# Goblin — Session Handoff (2026-05-30, before /clear)

> New session: read **this file first**, then Section 2's files as needed. Don't re-read the full audit to act.

## 1. Quick Orientation
Goblin = mobile-first "cloud workshop for builders" (chat → code → ship), domain **justgoblin.com**, founder **Vincent**. Build phase: pre-beta polish + first end-to-end flow audit. Today's pass = morning visual polish (8 fixes, committed `5a531be`) + a full autonomous **flow audit** (this session) producing 4 report files + 40 screenshots. Recent `git log` shows editor/settings/preview refactors to **v1.1 brand tokens** then polish then audit. Headline: **~62% beta-ready**. **MOST IMPORTANT:** local `pnpm dev` talks to **PRODUCTION** Supabase/Railway/Stripe — treat all authed actions as touching real data; do not seed/delete carelessly.

## 2. Authoritative Reference Files (priority order)
1. `Branding/GOBLIN_DESIGN_SYSTEM.md` (v1.1, **locked**) — design SSOT: tokens, GoblinLogo states, spinner ban, icon rules. Obey before any UI work.
2. `FLOW_AUDIT_2026-05-30.md` — today's audit. **Read the ⚠️ CORRECTIONS block at top first** — it supersedes body claims (authed app is German, projects exist, settings routing inverted, authed CLS bad).
3. `AUDIT_BACKLOG_2026-05-30.md` — prioritized work (P0–P3, effort, sprint slices). The build list.
4. `AUDIT_METRICS_2026-05-30.md` — LCP/CLS per route, TTFT, a11y counts (corrected authed CLS).
5. `TRIVIAL_FIXES_2026-05-30.md` — 5 pre-diagnosed micro-fixes, **not applied** (couldn't build-verify).
6. `POLISH_2026-05-30.md` — today's morning polish pass (what changed in `5a531be`).
7. `BACKLOG_2026-05-30.md` — yesterday's carry-over backlog.
8. `REFACTOR_*.md` (deleted from tree today — see Section 3; recover via git if prior-architecture context needed).
9. `tests/e2e/helpers/auth.ts` — canonical auth patterns (magic-link admin + password UI).

## 3. Repo State Snapshot
> Captured at session start + today's audit additions. Re-run `git status` to confirm live.

**`git status` (interpreted):**
- **Staged deletions** of old dated reports: `ARCHITECTURE_AUDIT_2026-05-28.md`, `BUILD_04_*`, `BUILD_05_06_*`, `CHAT_TIDY_REPORT_*`, `COMMIT_REPORT_2026-05-29.md`, `MOBILE_HEADER_AUDIT_*`, `REFACTOR_*` (3), `SETTINGS_WIRING_DIAGNOSIS_*`.
- **Modified:** `POLISH_2026-05-30.md`.
- **Untracked (today's audit, not yet committed):** `FLOW_AUDIT_2026-05-30.md`, `AUDIT_METRICS_2026-05-30.md`, `AUDIT_BACKLOG_2026-05-30.md`, `TRIVIAL_FIXES_2026-05-30.md`, `audit/` (harness scripts + out/), `audit-screenshots/` (40 PNGs), and this handoff.

**`git log --oneline -15` (top):**
```
5a531be polish: 8 visual fixes ahead of flow audit
6bb1418 docs: backlog for 2026-05-30 session
b91c4b9 refactor(editor): re-skin code editor + tabs to v1.1 brand tokens
a46d104 fix(preview): replace spinner with mark-breath, swap to lucide, token sweep, DE empty state
1266f2b refactor(settings): roll out container-query density to 14 sections + 4 sub-pages
```
**Interpretation:** tree has staged report-cleanup + uncommitted audit artifacts. Branch `master`. **All commits local — nothing pushed.** Audit added **zero source-code changes**; only docs/harness/screenshots are new.

## 4. Founder Decisions Already Made (do NOT re-ask)
- **Personas:** Max (Berlin, DE-first vibe-coder, DSGVO-sensitive), Rajesh (Bangalore, EN-only, mobile/4G), Sofia (Toronto, senior dev, high bar), Jake (SF, 19, impatient, mobile).
- **Quality bar:** 9/10, Stripe-level finish; months of work acceptable.
- **Language:** DE for app/user-facing; EN for technical/code/Claude-Code output. (Audit confirmed authed app IS German; marketing/login English.)
- **Editor theme:** dark-but-tokenised (`--surface-ink-2` / `--green-950`) is the **one** sanctioned dark surface in the light-default app.
- **BYOK:** all 8 providers + custom endpoint exposed.
- **Icons:** lucide site-wide; in-house Icon set retired in touched files only (full migration deferred).
- **ModelHub:** one shared `<ModelHub>` in Settings "Modelle" + `/models`.
- **Spinners:** forbidden. GoblinLogo states (breath/thinking/working/idle) are the only loaders (§B1.6).
- **Mobile bottom edge:** reserved — no bottom tab bar, no buttons in swipe zone.
- **Sidebar wordmark:** removed (redundant with header).
- **Settings arch:** SettingsModal (desktop) + SettingsRoot (mobile); share section components; `sections.ts` = desktop SSOT; mobile carries inline list (**known drift, documented**).
- **Trivial-fix authority:** ≤10 lines, defect-only, build-PASS-verifiable.
- **Today's audit boundary:** no source edits made.

## 5. Open Strategic Questions (await founder)
- **Vercel "use existing connection" UX** — needs design call before build.
- **Settings inline-fontSize tokenization** (181 decls / 24 files) — mass pass vs incremental? No approved method.
- **Mobile Code-Review (Screen 07)** — mockup-first agreed; mockup not produced.
- **Dev vs Prod separation** — `pnpm dev` → PROD services; founder aware, no staging-setup decision.

## 6. Today's Audit — Distilled Headlines
**Verdict ~62% beta-ready.** The hard part works: chat→code is fast (TTFT **1.18s**), correct, branded; authed German workspace with ~50 projects, working composer (default model **Gemini Flash**), real settings depth (BYOK/Integrations/Billing), solid auth guard, clean consoles, near-zero CLS on marketing. The unproven part is the *ship* half of the pitch + authed polish.

**Top P0 (corrected):**
1. **Deploy/build tail unproven** — chat→answer works; Apply→Build→Preview→Deploy never demonstrated on a real project. *(Journey 2)*
2. **No discoverable signup** — `/register` & `/onboarding` → `/login`. *(Journey 1)*
3. **Local dev → PROD backend** — careless script can mutate real data. *(Security)*
4. **`/settings` (top-level) hangs** on "WORKSPACE WIRD GELADEN" (real settings live at `/dashboard/settings/*`). *(Journey 3)*
5. **Trial-wall risk on first build** — verify create-project/first-build not gated. *(Journey 2)*

**Top P1:** EN-marketing/DE-app split (wall for Rajesh) · **authed CLS 0.18–0.35** (dash 0.349) · cold `/` LCP 3.5s · `/pricing`/`/help`/`/terms` LCP >2s · icon-only buttons missing aria-labels (dash/chat/settings) · mobile hero "workshop**for**" whitespace ≤390px · 404 project → login (no real 404) · dead **Imprint** link (DE legal) · error-state copy/recovery unverified · Connectors/BYOK page *contents* unverified (routes exist).

**Would Dario sign off?** Works: brand + chat-to-code primitive + auth + settings IA + privacy/help. Broken: can't show it *ship*; mixed-language UI; dev runs on prod. Verdict: **~62%** — finish the deploy loop, unify language, split dev/prod → confident beta.

**Coverage gaps (NOT verified):** Journey 2 tail (Apply/Build/Preview/Deploy), all error states (network-kill/rate-limit/invalid-BYOK/deploy-no-token), full axe-core, chat TTFT distribution (only 1 sample), settings persistence, account-deletion walk-up.

**Persona one-liners:** Max — "DE app + real privacy policy, but dead Imprint + won't cancel Claude till I see it deploy." Rajesh — "fast chat, but German help+app = I'm stuck." Sofia — "legit chat-to-code; where's the editor/build? gorgeous chat box." Jake — "looks sick; 3.5s cold + a settings URL threw me to login."

## 7. Recommended Next Actions
**Sprint 1 (unblock the demo):**
- **B1** prove the ship loop (seed→Apply→Build→Preview→Deploy, screenshot) — the demo dies without it.
- **B3** separate dev from prod (`.env.local.example` → staging) — safety before more authed testing.
- **B7** redirect/fix top-level `/settings` hang.
- **B8** real in-app 404 for bad project UUID (not login bounce).
- **B2** real signup path (`/register` or rename CTAs).
- **B5** guarantee first build is free (verify not trial-gated).

**Needs founder input before Sprint 1:** B1 deploy UX (§5 Vercel), B3 staging mechanism (§5 dev/prod). Get these two answered first.

**Suggested first build prompt:** scope = **B1 only** — "Demonstrate + harden chat→Apply→Build→Preview→Deploy on one seeded project." Out-of-scope: language unification, CLS, signup (separate items). 
**Sprint 1 effort estimate:** ~B1(L) + B3(M) + B2(M) + B5(S) + B7(XS) + B8(S) ≈ **5–9 dev-days**.

## 8. Operational Notes
- **Dev server:** `pnpm --filter @goblin/web dev` → http://localhost:3000. If it crashes, restart same cmd, wait for Ready. (Already running this session.)
- **Test creds:** root `.env.local` — `TEST_ACCOUNT_EMAIL=vinc.hafner3@gmail.com` / `TEST_ACCOUNT_PASSWORD`; `GROQ_FREE_API_KEY` for chat. Free-pool/comped account, ~50 `[E2E-TEST]` projects.
- **Authed localhost login** (magic-link lands on prod): use **password grant → `/auth/magic-callback#access_token=…`**. Pattern in `tests/e2e/helpers/auth.ts` + `audit/lean.mjs`.
- **Build/typecheck:** `pnpm --filter @goblin/web build` ; `pnpm --filter @goblin/web typecheck` (+ root `lint`).
- **Playwright now installed** (audit added). Reusable harnesses: `audit/lean.mjs` (fast authed capture → `audit/out/lean.json`), `audit/harness.mjs` (full sweep).
- **Screenshots:** `audit-screenshots/` — 40 PNGs by journey, referenced in FLOW_AUDIT.
- **Tool-pipeline caveats (this env):** multiple tool calls in one msg run parallel — one error cancels all siblings → **issue ONE call per msg, exit-0**. Foreground long bash **blocks all output** until it returns → run long jobs `run_in_background:true`. PowerShell mangles inline `node -e` quotes → use Bash for node.
- **Source tree:** zero code edits today; working tree clean of code changes.

## 9. Working-Style Reminders
- **Bartlett-Disziplin:** review-before-build, audit-before-fix.
- **One recommendation per question**, not an options buffet.
- **Verification gates** between sub-passes: typecheck PASS + build PASS + grep audit + mental trace.
- **Honest reporting:** "couldn't verify X" > "all green."
- **Scope discipline:** do the named work, document the rest, don't expand without permission.
- **Commits:** atomic, conventional messages, one per pass; **no push / no amend / no rebase / no force**; never push without founder review.
- **Reports → repo root as Markdown.**
- **Language:** respond German; caveman mode may be active (terse).
