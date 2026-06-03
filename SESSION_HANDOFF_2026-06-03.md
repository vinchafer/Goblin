# Session Handoff — 2026-06-03 (Sprint 10.6 close)

## State
Sprint 10.6 (Max-Walk Blockers hotfix) **COMPLETE**. 6 commits on master,
9998d1c → 47c631d (auto-pushed). typecheck (web+api+shared) + web prod build green.
Sprint 10 / 10.5 intact (additive changes only).

See **SPRINT_10_6_COMPLETE_2026-06-03.md** for the full per-item report, and
`sprint-10-6/*` for traces/evidence.

## Sprint 10.6 — what changed (the 2 real Max-walk blockers + 3 supports)
- **GitHub Connect now sticks**: the active Settings panel queried a dead
  `/api/connectors/status` (404) so it always showed "Verbinden". Now `/api/github/status`
  + one-click OAuth with `returnTo`. (Login-bounce prime suspect = Railway
  `NEXT_PUBLIC_APP_URL` domain — founder to verify.)
- **Send-to-Code makes real files**: multi-block sends no longer glue into one
  `// File:`-commented blob; `blocksToFiles()` splits into index.html / style.css /
  script.js with HTML-ref-matched names. Fixture 6/6.
- **Vercel URL**: deploy now polls until READY → canonical `<project>.vercel.app` alias.
- **Send-to-Code w/o project**: new-project create now deep-links to the Code tab so the
  stashed code is actually delivered (was landing on the hub/chat).
- **Vercel ownership UX**: onboarding card+callout, pre-deploy explainer, settings note —
  every user brings their own Vercel.

## Founder actions (Sprint 10.6 — before the Max-walk)
1. **No new migrations** in 10.6.
2. Verify Railway **`NEXT_PUBLIC_APP_URL`** == the canonical login domain (the GitHub
   login-bounce prime suspect), then disconnect+reconnect GitHub and confirm Settings →
   Konnektoren shows "@username". Railway logs: `github_callback {…}`.
3. Deploy a multi-file project; confirm `[vercel] deployment status … READY` with a
   non-null alias and "Öffnen" → 200.
4. **iPhone Max-walk** = the real sign-off (signup → Send-to-Code multi-block → live URL,
   Vercel ownership visible). Per-item checklists in `sprint-10-6/*`.

> CDP walks could not run this session (no Chrome remote-debugging port locally:
> `browser-harness` "DevToolsActivePort not found"). All visual/live verifies deferred
> to the founder walk.

---
## (Prev) Sprint 10.5 report below

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
