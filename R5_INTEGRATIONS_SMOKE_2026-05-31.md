# R5 — Integrations Visual Smoke (2026-05-31, Sprint 4 Phase 1)

Live browser smoke of the Sprint-2 Vercel connector UI, via CDP to the running Chrome
(`localhost:9222`). Script: `scripts/sprint-4/smoke-integrations.mjs`. Auth = password grant →
`/auth/magic-callback` (same pattern as `audit/lean.mjs`). Backend = Railway PROD.

## Surface under test
The **modern** settings connector (`components/settings/ConnectorsPage.tsx`), section
`connectors` ("Konnektoren"), rendered in:
- **Desktop** → `SettingsModal` (≥768px)
- **Mobile** → `SettingsSheet`/`SettingsRoot` (<768px)

> Note: the legacy `/dashboard/settings/integrations` route lists Vercel as "Coming soon" —
> that page is explicitly marked LEGACY in source and is not the live surface. The real,
> Sprint-2-wired Vercel connector is the one verified here.

## Screenshots
- `sprint-4/r5-integrations-smoke/desktop-1280.png` (1280×860)
- `sprint-4/r5-integrations-smoke/mobile-390.png` (390×844, full page)

## Verification (against R5 checklist)
| Check | Result |
|---|---|
| Vercel section renders (not "Coming soon") | ✅ real connector row |
| Connected state shows account name | ✅ `vinchafner2-1996` |
| Disconnect / "Trennen" button present | ✅ shown when connected |
| Density matches other settings rows | ✅ 36px avatar tile + label/detail, identical to GitHub/Stripe rows |
| Typography (Manrope / `--font-sans`, `--t-*`) | ✅ correct family + weights |
| Mobile: no horizontal scroll | ✅ `scrollWidth ≤ innerWidth` (probed: `horizScroll=false`) |
| Mobile: no overlap | ✅ rows stack cleanly in bottom-sheet |

Direct API probe (`GET /api/integrations/vercel`) returned
`{"connected":true,"account":{"username":"vinchafner2-1996","email":"vinc.hafner2@…"}}` →
backend connection healthy; UI reflects it correctly.

## Observation (non-blocking, no fix applied)
On first paint the Vercel row shows **"Lade…"** with a "Token einfügen" button until the
async status fetch to the Railway PROD API resolves (observed up to a few seconds at cold
latency). Once resolved it flips to the connected state ("vinchafner2-1996" + "Trennen").

- Functionally correct (a loading state, not a stuck state — `finally` always clears it).
- On a slow 4G first impression (Rajesh persona) the transient could *momentarily* read as
  "disconnected". A skeleton/optimistic treatment would smooth this — but that is a **design
  decision**, not a token-level fix, so it is **not** changed here under the no-invented-tokens
  rule. Logged for founder.

## Verdict
**Looks production-ready.** No fixes applied — doc-only. The connector renders, reports the
correct connected account, and is responsive with no layout defects at either width.
