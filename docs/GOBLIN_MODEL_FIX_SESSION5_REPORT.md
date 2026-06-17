# Goblin Model "(soon)" Fix + Settings → Goblin-Modelle — Session 5 Report

Date: 2026-06-17
Branch: master (builds on f00fd66, LIVE Layer-2)
Status: code complete, tests + build green, **NOT pushed** (awaiting founder approval per checkpoint c).

---

## 1. The bug (founder prod walk)

Goblin-bundled models showed **"Goblin Swift (soon)"** and were **not selectable** in
the chat model dropdown — on the founder's account AND a fresh account — even though
the backend reported `goblin_hosted` **active**.

## 2. Diagnosis (full detail: `docs/GOBLIN_MODEL_SOON_DIAGNOSIS.md`)

Measured prod flag (live): `GET /health/deep` →
`goblin_hosted: { state: "active", enabled: true }`. So the backend is genuinely
live; the break is on the read path into the picker. **Combination of two code
defects** (the brief's anticipated "RC-1 on web + catalog"):

- **RC-1 (web, the visible "(soon)").** `apps/web/components/app-shell/model-switcher.tsx`
  hard-coded the **"SOON"** badge (`:248-250`) and the **"GOBLIN HOSTED — COMING SOON"**
  group label (`:290`) for the `goblin_hosted` layer, ignoring the API `available`
  flag entirely. It never even reads `NEXT_PUBLIC_GOBLIN_HOSTED_API` — so flipping
  that Vercel env would NOT have fixed it. **Fix = code, not env.**
- **RC-3 (API, the selectability blocker).** `tierAllowedForPlan` (`goblin-hosted.ts`)
  gated `available` on an exact plan-string allowlist `['trial','build','pro','power']`.
  Any account whose `plan` reads back `null`/empty/legacy/`'free'` → `available:false`
  → greyed + unselectable. This contradicts the module's own documented intent
  ("no model plan-gating any more — spend governed by the allowance").
- **RC-2 (registry/migration) — NOT the cause.** The tiers are added programmatically
  by the catalog when the flag is on; **no DB/data migration was needed.** (HR-8 gate
  not triggered.)

## 3. The fix (code only — no migration, no blocking founder env change)

| Area | File | Change |
|---|---|---|
| Web picker | `apps/web/components/app-shell/model-switcher.tsx` | Badge + group label now derive from the live `available` flag. An available Goblin model renders as **"INKLUSIVE · KEIN KEY"** (green) and is selectable; the neutral "SOON" remains only as a defensive fallback for a genuinely unavailable entry. Collapsed-button tag for hosted → "INKLUSIVE". |
| API gating | `apps/api/src/services/goblin-hosted.ts` | `tierAllowedForPlan` now returns `true` — the **feature flag is the only gate**. The weighted monthly allowance (`goblin-cap.ts`) + trial-gate middleware remain the real spend/limit enforcers. `tier.plans` kept for docs/telemetry. |
| API router | `apps/api/src/services/model-router.ts` | Removed the dead plan-string refuse + the now-unused `getUserPlan` helper; Goblin routing is gated solely by `getGoblinHostedConfig()` (the flag). |

**Two-level truth preserved (HR-3):** no provider / model slug / cost-unit / `$` /
4.4 weight on any user surface (verified by grep, §5). **Layer-1 free-pool badge
untouched (HR-4)** — it is a separate `FREE_POOL_ENABLED` surface; only the Layer-2
"(soon)" was wrong, and only that was changed.

### Founder env note (optional, not blocking)
Set `NEXT_PUBLIC_GOBLIN_HOSTED_API=true` on Vercel so `GoblinUsageBar` renders its
live allowance state. **Not required** to fix the dropdown (the picker doesn't read it).

## 4. Settings → "Goblin-Modelle" area (Phase 2)

New first tab **"Goblin-Modelle"** in `apps/web/components/settings/ModelsPage.tsx`,
alongside the unchanged BYOK tab (now **"Meine Keys" / "My keys"**), clearly distinct
(included models vs your own keys). Contents (plain-spoken, **EN+DE mirrored**, no
provider/$/weight/token math, design-system, 390px):

- **Goblin Swift** (badge "Standard/Default") — *fast, light, no key needed — the right
  pick for most builds.*
- **Goblin Forge** (badge "Stärker/Stronger") — *the stronger model, for heavier or
  trickier work; uses your monthly allowance faster than Swift.*
- **Explainer** — both included in every plan, no API key, governed by a fair monthly
  allowance that resets each month, higher plans get more allowance. Link "Dein
  Kontingent ansehen → / See your allowance →" → `/dashboard?settings=usage`
  (the existing GoblinUsageBar / Nutzung section).

## 5. Self-audit (Phase 3)

- **API tests:** `vitest run` → **173 passed / 0 failed** (incl. new
  `catalog.test.ts` — 8 tests asserting both tiers `available:true` for trial / build /
  pro / power / null / empty / unknown plans, and absent when the flag is off; and the
  rewritten `goblin-hosted.test.ts` plan-gating + null-plan streaming guards).
- **Typecheck:** API `tsc --noEmit` clean; Web `tsc --noEmit` clean.
- **Web build:** `npm run build` → exit 0.
- **Leak grep** (`deepseek|deepinfra|kimi|moonshot|4.4|cost-unit|$0.|per-token`) on the
  changed user surfaces → only legitimate hits: the BYOK provider list ("DeepSeek" as a
  user's own-key option — unrelated to the Goblin tier backing) and code comments. No
  Goblin→provider mapping leaks.
- **EN/DE parity:** every new string is `t(lang, de, en)`.
- **Free-pool (Layer 1) badge:** untouched.
- **Migrations:** none added (HR-8 not triggered).

## 6. Founder iPhone re-walk checklist (HR-11 — founder verifies; no CDP walk)

1. **New / trial account → chat model dropdown** shows **Goblin Swift** + **Goblin Forge**
   as **selectable** (badge "INKLUSIVE · KEIN KEY", full opacity) — **no "(soon)"** on
   the Goblin (Layer-2) rows.
2. **Pick Goblin Swift → send a message → a real reply streams.** Repeat for **Goblin
   Forge** — also streams.
3. **Settings → Modelle → "Goblin-Modelle"** tab explains Swift vs Forge; the **"Meine
   Keys"** (BYOK) tab is still present and separate.
4. The **free-pool "Coming Soon"** badge (Layer 1) still shows — unchanged.
5. The **usage bar still moves** after generating; allowance behavior unchanged.

> If a Goblin row still reads "(soon)" after deploy, confirm the web deploy shipped
> this commit (the picker no longer hard-codes "SOON"); optionally set
> `NEXT_PUBLIC_GOBLIN_HOSTED_API=true` on Vercel for the usage bar.

## 7. Files changed
```
M apps/api/src/services/goblin-hosted.ts        # tierAllowedForPlan → flag-only gate
M apps/api/src/services/goblin-hosted.test.ts   # plan-gating + null-plan stream guards
M apps/api/src/services/model-router.ts         # drop dead plan refuse + getUserPlan
M apps/web/components/app-shell/model-switcher.tsx  # badge/label from `available`
M apps/web/components/settings/ModelsPage.tsx       # new "Goblin-Modelle" tab (EN/DE)
A apps/api/src/services/catalog.test.ts          # availability regression net
A docs/GOBLIN_MODEL_SOON_DIAGNOSIS.md            # Phase-0 diagnosis
A docs/GOBLIN_MODEL_FIX_SESSION5_REPORT.md       # this report
```
SHAs recorded on push.
