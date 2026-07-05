# T2 — Achievement-triggered upgrade card

## Diagnosis
The achievement moment is already instrumented client-side: `SessionPane.liveStellen()`
calls `bumpPublishCount(projectId)` **only** on the truth-gated Live (`url` returned from
`deploySession`, after the server's `verifyDeployment` checks pass — never on
deploy-started or a draft save). That is the FEEL-1 P0.2 verified-Live moment. MOBILE-1's
`StatusStrip` exposes a JIT-card slot and `JitCard` is the sibling pattern (per-project,
localStorage). The upgrade card differs in scope: **once per USER, ever** — so it needs
server-side persistence, not localStorage.

The status strip (`.gb-mobile-surface-top`) is **mobile-only** (hidden ≥860px), so the
slot alone can't reach desktop → the spec's "chat-surface toast-card variant" is required
for desktop. Both placements share one component.

## Build
- **Migration `0079_achievement_upgrade_card.sql`** (⚠ FLAGGED — must be founder-applied,
  same batch as pending 0077/0078): `users.achievement_upgrade_card_seen_at TIMESTAMPTZ`.
  NULL = never shown; a timestamp = seen. No behavioural gate.
- **Pure helper** `apps/api/src/lib/achievement-card.ts` — `shouldShowAchievementCard(row)`
  = active-trial (via `derivePlanTruth`, the authoritative entitlement) AND flag NULL.
- **Endpoints** (`apps/api/src/routes/users.ts`):
  - `GET /api/users/me/achievement-card` → `{ show }`.
  - `POST /api/users/me/achievement-card/seen` → stamps the flag (idempotent, `.is(null)`
    guard preserves first-seen).
- **Component** `apps/web/components/code/AchievementUpgradeCard.tsx` — `slot` + `toast`
  variants; honest copy (see below); CTA → `/dashboard/upgrade` (the real plan page).
- **Wiring** (`SessionPane.tsx`): on truth-gated Live, `GET achievement-card`; if `show`,
  render (slot takes precedence over the JIT card on this publish; toast on desktop) and
  `POST seen` immediately → cannot re-appear even if the tab closes. Dismiss/CTA close it.

## Copy (honest — no invented claims)
Eyebrow: **DEINE APP IST LIVE** / YOUR APP IS LIVE
Body: *"Genau dafür ist Goblin gebaut. Mit einem Plan bleibst du dran — mehr Einheiten pro
Monat, und dein Zugang endet nicht."* / EN analog.
CTA **Pläne ansehen** / See plans · secondary **Später** / Later.
- "mehr Einheiten pro Monat" traces to real facts: trial ≈33 builds vs Build ≈116
  (`plan-builds.ts`). ✓
- "dein Zugang endet nicht" traces to plan truth: paid access has no trial expiry. ✓
- Dropped the spec's "mehr Projekte" — projects are **unlimited on every plan** (would be a
  false claim). No price shown in-card (the plan page carries the real $11).
- No urgency, no block, no nag: shows once, dismiss final.

## Gate evidence
- Unit test `apps/api/src/lib/achievement-card.test.ts` — trial+unseen→show; seen→no (once);
  expired→no; paid→no; comped→no. **5 passed.**
- `tsc --noEmit` — **API clean, web clean.**
- E2E `tests/e2e/33-achievement-upgrade-card.spec.ts` (@local-only): active-trial→show=true;
  seen→second publish show=false; dismiss persists across fresh login; paid→never.
  Asserts the real server contract the client renders 1:1.
  **RUN STATUS: PENDING** — requires migration 0079 applied to the DB (single shared
  Supabase; not self-applying per founder-migration rule). No live Vercel deploy needed for
  the card logic (the verified-Live moment is FEEL-1-tested; the card keys off it).
- Render: `T2-card-render-harness.html` (deterministic, real `--ed-*` dark tokens) — slot
  (DE) + toast (EN) variants captured desktop (1280) + narrow. Copy + gold accent verified.
