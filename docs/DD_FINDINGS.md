# DD_FINDINGS — Master Register

Buyer-side technical due-diligence on Goblin. Skeptical, evidence-backed. Every PASS
cites an artifact; every FAIL cites file:line + repro. Banned in verdicts: should/looks/
appears/probably. Status ∈ {FIXED, RECOMMENDED, UNVERIFIED}.

Severity: **P0** breaks the core product / data-loss / secret leak · **P1** wrong behaviour a
user hits on a core flow · **P2** correctness/consistency a user can hit on the long tail ·
**P3** polish / hygiene.

Branch `dd-hardening-2026-06-20`. Nothing merged to master. No migration applied. No real spend.

---

## Register

| ID | Phase | Sev | Surface | Root cause (file:line) | Status | Evidence |
|----|-------|-----|---------|------------------------|--------|----------|
| P0-1 | P0 | P0 | Dashboard start composer | `apps/web/app/dashboard/page.tsx:216` `.gobl-hero` had `overflow:'hidden'` → clipped the `ChatInput` `ModelHub` dropdown (opens downward in hero) | FIXED | Removed `overflow:hidden`; border-radius still clips the fill, popover escapes. Web typecheck PASS; build PASS; founder re-walk = DD_REWALK §1 |
| P0-2 | P0 | P0 | Model picker (all 3 composers) | `apps/web/components/chat/ChatInput.tsx:137,263` `ModelHub` rendered every `goblin_hosted` row as a static non-clickable `<div opacity:.5>` + hard "SOON", ignoring the live `available` flag. 2nd SOON source Session 5 missed (it fixed only `model-switcher.tsx`). Same `ChatInput` powers dashboard hero + standalone-chat + workspace chat-tab | FIXED | Hosted rows now use the availability `filter` + shared selectable `ModelRow` with "INKLUSIVE · KEIN KEY". `catalog.test.ts` proves data contract (avail:true/badge GOBLIN_HOSTED, all plans). API 185/0; web typecheck+build PASS; DD_REWALK §2 |
| P0-3 | P0 | P0 | Swift/Forge end-to-end | n/a (verification) | FIXED | `goblin-hosted.test.ts`: "Swift streams… never leaks slug", "Forge routes to Kimi", "Swift on TRIAL". `catalog.test.ts` badge contract. All green (185/0). Live real-provider stream = founder (P-COST: no autonomous spend) |
| F4-1 | 4 | P1 | Usage view "Pro Modell" | `apps/api/src/routes/users.ts:124` shipped raw `agent_runs.model_used` to the client → leaked tier id `goblin/efficient` + raw BYOK slugs on `/dashboard/usage` AND Settings usage tab | FIXED | New `lib/model-label.ts` scrubs server-side (Goblin→public name; defensive "Goblin" for any goblin_hosted non-tier-id; BYOK humanized). `lib/model-label.test.ts` (5 tests). API 190/0 |
| F4-2 | 4 | P1 | Project chat enforcement | `apps/api/src/middleware/usage-limit.ts` (wired `chat.ts:44`) caps ALL tiers at `monthly_limit` (200 default) — incl. BYOK (UI promises "kein Limit von Goblin") and goblin_hosted (already capped by the weighted allowance). Applied ONLY to `/api/chat/stream`; standalone chat `/api/chat-sessions/*` has NO such cap → trivially bypassable + wrong-blocks legit users | RECOMMENDED | Trace: `usage-limit.ts` is the sole incrementer of `monthly_requests_used`; `billing.ts`/`admin.ts`/`support-agent.ts` + 3 web surfaces READ it. Removing enforcement freezes the counter → stale billing numbers. Coupled → DD_RECOMMENDATIONS §A (one ordered change-set + migration). NOT executed unattended (billing blast radius unverifiable here) |
| F4-3 | 4 | P1 | Two limit systems shown | Settings `UsagePage.tsx:75` shows weighted `GoblinUsageBar` AND legacy "Goblin-Anfragen X/Y" (monthly_limit); `dashboard/usage/page.tsx:31` leads with "X von Y Anfragen"; `SidebarUsage.tsx:87` pct bar vs monthly_limit | RECOMMENDED | Same coupling as F4-2 (the counter goes stale once enforcement is retired). Full display rewire to `totalInPeriod`/`goblinCap` documented in DD_RECOMMENDATIONS §A |
| F4-4 | 4 | P1 | Public pricing copy | `geo-pricing-section.tsx:16` (+ `pricing-cards.tsx:11`) advertise "200/800/3,000 **AI requests / month**" — the legacy metric. Numbers are ascending (no Build>Pro inversion in current code). "BYOK unlimited" is only honest once F4-2 enforcement is removed | RECOMMENDED | Coupled to F4-2 (can't honestly say BYOK-unlimited while the 200-cap still hits BYOK). DD_RECOMMENDATIONS §A step 4 |

---

## Notes carried forward (to be worked in later phases)
- **Usage view name leak** (Phase 4): prior reports say the usage "Pro Modell" view leaked
  `llama-3.3-70b-versatile` and showed `goblin/efficient` instead of "Goblin Swift". Re-verify
  against current code; grep-prove zero slug/tier-id leaks across the whole web surface.
- **Two limit systems** (Phase 4): legacy request-count ("Goblin-Anfragen 46/200") vs the new
  weighted token allowance. Decision is MADE: unify on the weighted allowance; retire the legacy
  request-count everywhere it surfaces; fix landing/pricing copy (no "AI requests"; no Build>Pro).
- **Free pool "Coming Soon"** (Phase 5): verify live-or-not; ungate if real, else document the gap.
- **No web component-test harness** (Phase 1): apps/web has zero unit/component tests (no vitest/
  RTL/jsdom). Render-level regressions (like P0-2) cannot be caught in CI. → DD_RECOMMENDATIONS.
