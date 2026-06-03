# Session Handoff — 2026-06-03 (Sprint 10.5 close)

## State
Sprint 10.5 (Max-Walk Fixes) **COMPLETE**. 25 commits on master,
1e898d4 → ebaf872 (auto-pushed via post-commit hook). Full typecheck + prod
build green. Sprint-10 Convergence intact.

See **SPRINT_10_5_COMPLETE_2026-06-03.md** for the full slice-by-slice report.

## What changed
- **Onboarding (Phase A)**: new Step 0 language selection → 6 steps; the
  3-layer story (Free / Goblin-Hosted Q1 2027 + waitlist / Premium BYOK); real
  provider logos; clickable links + Fireworks power card + Claude-Pro disclosure;
  honest tool list (BALD/BETA); Step 5 re-skin + mobile hint + Supabase/Railway;
  lands at project-create. Root-fixed the broken onboarding token aliases behind
  most green-on-green.
- **Core flow (Phase B)**: ModelPickers show connected-only + scrollable +
  auto-select; "Sag Goblin" → project-or-chat modal; Send-to-Code works without a
  project; Vercel canonical-alias URL; sidebar +-buttons equal + new-project from
  any page; Settings stays in-modal + smooth scroll; mobile viewport zoom lock;
  /dashboard/chat loading → GoblinLogo; code-block </> chip polish.

## Founder actions (required before beta invites)
1. Apply migrations **0059** + **0060** to prod Supabase.
2. Align **GitHub OAuth** callback URL ↔ Railway env (sprint-10-5/GITHUB_OAUTH_FOUNDER_ACTION.md).
3. Check **Vercel Deployment Protection** if deploy URLs still 404 (sprint-10-5/VERCEL_DEPLOY_FOUNDER_NOTE.md).
4. Deploy web (Vercel) + API (Railway); re-walk Max on a real iPhone.

## Environment notes for next session
- Dev: `pnpm dev` (web :3000, api :3001, dev-guard active, test user vinc.hafner3).
- CDP Chrome: launch with `--remote-debugging-port=9222 --user-data-dir=<repo>/.chrome-debug-profile`; drive via `browser-harness`.
- Onboarding preview (logged-in user with keys): set localStorage
  `goblin:preview-onboarding=1` (dev-only bypass in chrome.tsx; dead in prod).

## Deferred
- Mobile project-hub dashboard polish (separate 3-5h sub-sprint).
- Real i18n (preferred_lang persisted; app strings DE-hardcoded).
- TRIVIAL_FIXES_10_5.md: 👺 emoji headers, two new-project modals.
