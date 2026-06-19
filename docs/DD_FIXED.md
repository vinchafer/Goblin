# DD_FIXED — what changed, why, and the regression proof

Branch `dd-hardening-2026-06-20`. Each entry: the defect, the change, before→after,
and the test/check proving neighbors still work. Nothing merged to master.

---

## Commit `93781cf` — P0: Goblin models selectable in the composer + un-clipped dropdown

**Files:** `apps/web/components/chat/ChatInput.tsx`, `apps/web/app/dashboard/page.tsx`,
`apps/api/src/services/catalog.test.ts`.

**P0-2 — the second "SOON" source.** `ChatInput.ModelHub` is the picker for ALL three
composers (dashboard hero, standalone chat, workspace chat-tab).
- Before: `const hostedModels = models.filter(m => m.layer === 'goblin_hosted')` (no
  availability filter), then each rendered as a static `<div opacity:.5>` with a
  hard-coded `SOON` badge — not a button, no `onSelect`. Flag- and `available`-blind.
- After: `const hostedModels = filter(models.filter(... 'goblin_hosted'))` (same
  availability filter as byok/free), rendered through the shared selectable `ModelRow`
  with an "INKLUSIVE · KEIN KEY" badge. When the server flag is off the API returns no
  hosted rows → the section is simply absent (no false SOON).

**P0-1 — clipped start dropdown.** `apps/web/app/dashboard/page.tsx`.
- Before: `.gobl-hero` section had `overflow:'hidden'`, clipping the hero `ModelHub`
  (which opens downward) so the list rendered cut off / behind the card below.
- After: removed `overflow:'hidden'` (kept `border-radius`, which still clips the dark
  fill to the border-box — only the popover escapes). No new stacking context created.

**Regression proof:** `apps/web` typecheck PASS; `apps/web` build PASS (exit 0, full
route list, no errors). `catalog.test.ts` gains a badge-contract test asserting hosted
tiers are `available:true` / badge `GOBLIN_HOSTED`, never `COMING_SOON`. API suite
**185/0**. Existing `goblin-hosted.test.ts` (Swift streams / Forge→Kimi / Swift-on-trial,
no slug leak) untouched and green. `GoblinLogo` import retained (still used by
`ProviderIcon`).

---

## Commit `1849cd0` — P1: scrub the usage-view model-name leak (two-level truth)

**Files:** `apps/api/src/lib/model-label.ts` (new), `apps/api/src/lib/model-label.test.ts`
(new), `apps/api/src/routes/users.ts`.

**Defect.** `GET /api/users/me/usage` built `byModel` from the raw `agent_runs.model_used`
and shipped it to the client. Both usage surfaces (`/dashboard/usage` and the Settings
usage tab) render `m.model` verbatim → leaked the internal tier id `goblin/efficient`
and raw BYOK slugs (`groq/llama-3.3-70b-versatile`).
- Before: `const m = (r.model_used as string) ?? 'unknown'; modelMap[m] = …`
- After: `usageModelLabel(r.model_used, r.source_tier)` → Goblin runs become
  "Goblin Swift"/"Goblin Forge"; any `goblin_hosted` run that didn't record a known
  tier id collapses to the neutral "Goblin" (so a future routing change can't leak the
  underlying open-source slug); BYOK/free slugs are humanized (prefix dropped, date
  stripped, title-cased).

**Regression proof:** new `model-label.test.ts` (5 tests: Goblin ids→public names; never
an underlying slug for goblin_hosted; BYOK humanized w/o prefix; date suffix stripped;
empty/null handled). API suite **190/0**. Server-side scrub fixes BOTH web surfaces from
one point; the client-side prefix-strip in `UsagePage.tsx:114` becomes a harmless no-op
(label already clean). `GoblinUsageBar` (weighted allowance, HR-4) untouched and verified
leak-free by reading.

---

## Not changed on purpose (logged instead — see DD_RECOMMENDATIONS)
- Legacy request-count limit retirement (F4-2/3/4): coupled to billing reads + a
  migration; partial edits cause stale billing numbers → §A.
- Disabled-free-pool advertising (F5-1): coupled to keyless default-selection + the prod
  DB-cache state → §C.
- apps/web component-test harness (no vitest/RTL) → §B.
