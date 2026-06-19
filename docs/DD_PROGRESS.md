# DD Hardening — Progress Log (recoverable state)

Branch: `dd-hardening-2026-06-20` · started 2026-06-20 · model Opus 4.8, autonomous.
Rule: branch only, never push master. Evidence or it didn't happen. No real DeepInfra spend.

Append-only. Newest at the bottom. If interrupted, resume from the last unchecked item.

---

## Baseline (verified at start)
- `pnpm install` — already up to date (4 workspace projects).
- `pnpm --filter @goblin/api test` → **184 passed / 0 failed** (13 files).
- `pnpm --filter @goblin/web typecheck` → clean.
- Git: branched off master `a0600b8` (HEAD). Working tree carried pre-existing
  uncommitted founder changes (deleted report .md, untracked `audit/`, `.next-build/`).
  These are NOT mine — I stage only files I touch (never `git add -A`).

## PHASE P0 — the three walk blockers
- [x] **P0-1 dropdown clipped on start composer.** Root cause: `apps/web/app/dashboard/page.tsx`
  `.gobl-hero` section had `overflow:'hidden'`; the shared `ChatInput` model dropdown
  (`ModelHub`, opens downward in hero) was clipped by it. Fix: removed `overflow:'hidden'`
  (border-radius still rounds the dark fill; only the popover escapes). FIXED.
- [x] **P0-2 Goblin models read "SOON" / not selectable in a new chat.** Root cause:
  `apps/web/components/chat/ChatInput.tsx` `ModelHub` rendered every `goblin_hosted`
  row as a static non-clickable `<div opacity:0.5>` with a hard-coded "SOON" badge —
  flag-blind and `available`-blind. This is the SECOND source Session 5 missed (Session 5
  only fixed the header `model-switcher.tsx`). The same `ChatInput` powers ALL THREE
  composers (dashboard hero, standalone chat, workspace chat-tab), so all three were broken.
  Fix: hosted rows now go through the same availability `filter` + the shared selectable
  `ModelRow`, with the "INKLUSIVE · KEIN KEY" badge (consistent w/ model-switcher). FIXED.
- [x] **P0-3 end-to-end (mock).** API data contract + streaming already green:
  `catalog.test.ts` (both tiers `available:true`, badge `GOBLIN_HOSTED`, never COMING_SOON,
  all plans incl null/legacy/comped; none when flag off; no slug leak; stale-row guard) +
  `goblin-hosted.test.ts` (Swift streams, Forge routes to Kimi, Swift on trial; no leak).
  Added `catalog.test.ts` badge-contract test. API now **185/0**. Web typecheck clean.

### P0 evidence status
- Backend/contract + streaming: PROVEN (runnable vitest, 185/0).
- Web render (pixels / click): the web app has **no component-test harness** (no vitest/RTL/jsdom)
  and jsdom/RTL are not in the offline store — standing one up mid-autonomous-run is too flaky.
  Render-level confirmation is therefore: (a) web typecheck PASS, (b) web build PASS [pending],
  (c) diff trace (SOON div deleted; hosted now via the same selectable `ModelRow` as working
  tiers), (d) founder live re-walk (DD_REWALK). Logged as a real gap → DD_RECOMMENDATIONS
  (add Vitest + React Testing Library to apps/web).

## DONE since baseline
- [x] P0-1 / P0-2 / P0-3 fixed + committed (`93781cf`). Web build PASS (exit 0).
- [x] Phase 4 usage-view model-name leak → FIXED + committed (`1849cd0`, api 190/0).
- [x] Phase 4 legacy request-count limit system → fully MAPPED. Decision: do NOT
  execute unattended — it's one coupled unit (enforcement is the only incrementer of
  `monthly_requests_used`, which billing/admin/support + 3 displays read; pricing
  "BYOK unlimited" depends on the enforcement change). Removing pieces in isolation
  yields STALE billing numbers. Documented as a single ordered change-set →
  DD_RECOMMENDATIONS §A (+ migration per G-6). Findings F4-2/3/4 logged RECOMMENDED.
  This is the honest call (G-3/G-4): billing blast radius is unverifiable in-sandbox.

## DONE (continued)
- [x] Phase 2 security: admin/investor unforgeable (fail-closed secret + proxy isAdmin gate),
  per-route authN consistent, IDOR-safe (user_id scoping), Stripe webhook sig+idempotent,
  secret hygiene clean. 3 P2/P3 notes (test-auth origin-spoof, cap-concurrency TOCTOU,
  share-token entropy). PASS verdicts logged with evidence.
- [x] Phase 5: free pool = OFF by design (`FREE_API_POOL=[]`), coming-soon UI honest →
  documented verdict. Side-bug F5-1 (picker still advertises free Gemini/Llama) → §C.
  Telemetry reconciliation re-proven (`goblin-telemetry.test.ts` green, part of 190/0).
- [x] Phase 1: TODO/FIXME inventory (4 minor TODOs, 0 FIXME/HACK); stack modern; env hygiene clean.
- [x] All six DD docs written (FINDINGS/FIXED/RECOMMENDATIONS/COVERAGE/REWALK/PROGRESS).

## FINAL STATE
- Branch `dd-hardening-2026-06-20`, NOT merged to master. No migration applied. No real spend.
- Commits: `93781cf` (P0 fixes), `1849cd0` (usage leak), `56b3904` (legacy-limit map docs),
  + final docs commit.
- Tests: api **190/0**; web typecheck PASS; web build PASS.
- Fixed: P0-1, P0-2, P0-3, F4-1 (leak). Mapped+recommended: F4-2/3/4 (legacy limit),
  F5-1 (free-pool advertising), §B (web test harness). Security: PASS + 3 minor notes.

## NOT done (honest — for a future pass)
- Phase 3 long-tail VISUAL walk at 390px (no browser this run) → DD_REWALK + DD_COVERAGE ▢ rows.
- Deep injection/XSS fuzz of every input (spot-checked; markdown render + Supabase params
  parameterized — no string-built SQL seen).
- The legacy-limit + free-pool retirements (deliberately documented, not executed — coupling/billing).
