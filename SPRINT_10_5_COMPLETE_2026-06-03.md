# Sprint 10.5 — Max-Walk Fixes — COMPLETE ✅

Date: 2026-06-03. Branch: master. Range: 1e898d4 (phase 0) → ebaf872 (B-S11).
25 commits (2 phase-0 docs + 12 A slices + Gate report + 11 B slices). All
local; post-commit hook auto-pushes.

## Headline: ✅ COMPLETE
Phase A (strategic onboarding re-work) and Phase B (core-flow fixes) both done.
Gate A passed between them. Full typecheck (web + shared + api) and production
build green at close. Sprint-10 Convergence intact.

## A — Strategic onboarding re-work (12/12)
- A-S1 ✅ Step 0 language (EN/DE), preferred_lang persistence, migration 0059, 6-step counter. **Root-fixed the broken onboarding token aliases (self-referencing var() → empty) that caused green-on-green across the flow.** (26f78d6)
- A-S2 ✅ Step 1 PATH B contrast (6729bdd)
- A-S3 ✅ Real provider logos via ProviderLogo (currentColor SVGs) (2f758c9)
- A-S4 ✅ Clickable guide links + Fireworks/Together/OpenRouter POWER card + Claude-Pro/Plus disclosure (DE) (33b7de5)
- A-S5 ✅ Empty dark-green panels (resolved by token fix + banner contrast) (48f9ce1)
- A-S6 ✅ **THE LAYER STORY** — Step 3 rewritten: L1 Free (active) / L2 Goblin-Hosted (COMING Q1 2027 + waitlist) / L3 Premium BYOK. Waitlist route + migration 0060. (ff219cb)
- A-S7 ✅ Step 3 bullet contrast (bullets removed by rewrite) (2c77c4a)
- A-S8 ✅ Rounded-rect toggles + honest tool list (BALD/BETA, deploy=Vercel) + recap contrast (824165e)
- A-S9 ✅ Step 5 re-skin (fixed styled-jsx scope bug) + real logos + honesty badges + Supabase/Railway + desktop mobile-hint (4a67d11)
- A-S10 ✅ GitHub redirect_uri fallback + encode + token-exchange match; founder doc (5ec334e)
- A-S11 ✅ Onboarding finish → /dashboard?start=1 opens project-create, not chat (c6397de)
- A-S12 ✅ Back-link/eyebrow collision fixed globally + step counters →06 (d19939f)

## Gate A — ✅ PASSED (ca0fdb4)
typecheck PASS, build PASS, Sprint-10 features intact (Code Tab multi-session,
Ctrl+K palette, git pill, explorer, intent), full Max walk @390×844 lands at
project-create. Evidence: sprint-10-5/gate-a-walk/.

## B — Core-flow fixes (11/11)
- B-S1 ✅ Code ModelPicker connected-only + scrollable + auto-select (112382d)
- B-S2 ✅ Chat composer ModelHub connected-only + height cap + hero opens-down (0aa046d)
- B-S3 ✅ "Sag Goblin" → project-or-chat choice modal w/ idea prefill (a6fc1c9)
- B-S4 ✅ Send-to-Code works without a project (picker + stash + CodeWorkspace consume) (a414132)
- B-S5 ✅ Vercel canonical alias URL + logging + founder note (91dcf70)
- B-S6 ✅ Sidebar +-buttons equalized + NewProjectModal global in shell (works any page) (c442d0d)
- B-S7 ✅ Settings Modelle/provider stays in-modal + overscroll-contain scroll fix (ec0cad9)
- B-S8 ✅ New-project modal mobile scaling verified + colour-row wrap (f0bc979)
- B-S9 ✅ Viewport meta: zoom locked on app routes, allowed on marketing (64328f8)
- B-S10 ✅ Logo regression: /dashboard/chat spinner → GoblinLogo (2a317b6)
- B-S11 ✅ Chat code-block </> → clean labelled "Code" chip (ebaf872)

## Final self-test
- typecheck: web ✅ shared ✅ api ✅
- production build: ✅ Done (all routes incl. /welcome/language)
- Sprint-10 features verified intact (Gate A + Code Tab multi-session loads w/ new GoblinLogo)
- Evidence: sprint-10-5/phase-c-walk/

## Founder action list
1. Apply migrations **0059** (users.preferred_lang) + **0060** (goblin_hosted_waitlist) to prod Supabase. Frontend degrades gracefully until then.
2. **GitHub OAuth**: align the OAuth App callback URL with `GITHUB_REDIRECT_URI_RAILWAY` (one canonical URL). See sprint-10-5/GITHUB_OAUTH_FOUNDER_ACTION.md.
3. **Vercel deploy**: if a clean alias still 404s, disable Vercel Deployment Protection. See sprint-10-5/VERCEL_DEPLOY_FOUNDER_NOTE.md. Check Railway logs for `[vercel] deployment …` after next deploy.
4. Push (auto-push hook should have handled it) + deploy web (Vercel) and API (Railway).
5. Re-walk Max on a real iPhone (fresh signup → first publish).

## Open / deferred
- Mobile project-hub dashboard polish — Vincent's suggested separate 3-5h sub-sprint (NOT in 10.5).
- Real i18n — app strings stay DE-hardcoded; preferred_lang is persisted for the future.
- 👺 emoji brand glyphs on non-Max pages (legal/status/badge/admin) — TRIVIAL_FIXES_10_5.md.
- Two new-project modals exist; consolidate (TRIVIAL_FIXES_10_5.md).
- Prod verification of B-S4/B-S5 behaviour is verify-on-use (CORS wall locally; founder confirms post-deploy).

## Self-assessment (Bartlett)
Strongest work: catching the **onboarding token self-reference bug** — it was the
single root cause behind most "green-on-green" reports and the Step-5 styled-jsx
scope bug, so several "polish" slices became one structural fix plus targeted
verification. The layer-story rewrite (A-S6) directly answers Max's "why not use
Claude directly?" by naming Layer 2. Honesty passes (A-S8 tools, A-S9
integrations, B-S5 deploy) chose truthful-over-impressive per Vincent's bar.
Weakest: some B-slice behaviours (STC-without-project end-to-end, Vercel URL on a
real deploy) are verified by typecheck + code-path reuse rather than a live run,
because local can't fully exercise prod deploy/CORS — flagged honestly for the
founder's iPhone walk.

## Beta-readiness verdict
Onboarding is now confident, layered, honest, readable, and lands at
project-create. The post-onboarding core-flow bugs Max hit are fixed. With the
founder's 4 console actions (migrations, GitHub callback, Vercel protection,
deploy) applied, this is the version to invite real beta users to. The Max walk
(signup → onboarding → build → publish) should run clean in under 5 minutes.
