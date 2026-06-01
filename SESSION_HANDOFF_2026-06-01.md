# Goblin — Session Handoff (2026-06-01, after Sprint 7 overnight)

> Full report: **SPRINT_7_COMPLETE_2026-06-01.md**. This is the 60-sec version.

## The one thing that matters
The **full multi-session Code-Tab vision is built** — parallel sessions, an in-tab AI
composer that streams code into the editor live, per-session models, the
Entwurf→Gesichert→Veröffentlicht spine, mobile single-column. It is **latent** until
you do two ops: `npx supabase db push` (migration 0055) **and** redeploy the API to
Railway. Until then the Code Tab safely shows the Sprint-6 classic editor (verified —
zero regression). The seam between this code and the live tables is the one thing that
hasn't had a real run; the e2e harness (`SPRINT7_LIVE=1`) is ready for it.

## State
- **Sprints 1–7 done.** Beta-readiness ~88% built; remaining gap is mostly operational.
- **6 commits**, `8303058` → `c7446d6`, local on `master`. Not pushed. typecheck
  (api+web) + production build green.

## Founder action list (priority order)
1. `npx supabase db push` (applies 0055 — `code_sessions*` tables).
2. Push these commits → Railway redeploys the API with `routes/code-sessions.ts`.
3. Confirm a BYOK model key for the test user (streaming agent needs a model).
4. Live walk the Code Tab: prompt → stream → Entwurf → Sichern → Veröffentlichen;
   2nd parallel session; Send-to-Code picker. Or `SPRINT7_LIVE=1` Playwright.
5. Eyeball the "Chat öffnen" button (fixed) + the new /about /manifesto /changelog.
6. Push after review.

## What shipped this session (one-liners)
- **Multi-session Code Tab (`8303058`):** 0055 migration + `/code-sessions` REST/SSE +
  streaming agent (prompt → live editor → draft files) + workspace UI; classic
  fallback when the API is down.
- **Draft review + e2e (`c89d904`):** Kopieren/Verwerfen on draft files; founder test.
- **Readable button (`5adb6b8`):** fixed a circular `--bone` token — "Chat öffnen" was
  dark-on-dark across the whole dashboard. Verified live.
- **Footer pages (`850d94a`):** /about, /manifesto, /changelog; dead links removed.
- **Activity feed (`1b69924`):** chat + deploys merged, newest first.
- **Density (`c7446d6`):** section-title 700→600 + `DENSITY_AUDIT_2026-06-01.md`.

## Operational notes (unchanged)
- `pnpm dev` → :3000 (web), :3001 (local API); web talks to **prod** API + **prod**
  Supabase (no local DB). Test creds in `.env.local`. No push / no amend / no force.
- Editor-theme + Code-Tab tokens still PROPOSED for design-system v1.2
  (`CODETAB_PROPOSED_TOKENS_2026-06-01.md`) — `--ed-deployed` added this sprint.
- CDP browser on :9222 was already logged in (project c7f53841) — used for live checks.
