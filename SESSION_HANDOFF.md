# Session Handoff — after Sprint 10.8 (2026-06-04)

## State
Sprint 10.8 complete: 11/11 items, 9 atomic commits (c8bc828 → d0773a9).
typecheck (api+web+shared) green. Web prod build green. Pushed to origin/master.

## What shipped
- **Dynamic catalog**: models table is now a CACHE synced from LiteLLM
  (`services/catalog.ts`) + per-user BYOK `/models` discovery
  (`services/provider-discovery.ts`). Read path = `getCatalogForUser()`.
- **Code-Tab polish**: Send-to-Code preview sheet, icon-only mobile bottom row,
  file-navigation panel, code-tab chat edit-in-place (→ live diff).
- **Vercel "Öffnen" 404 root-caused + fixed**: now returns the public production
  alias (was the protection-gated deployment hash url). `?debug=1` shows both.

## Founder actions (in priority order)
1. Apply `supabase/migrations/0061_dynamic_catalog.sql` (idempotent).
2. Set `LITELLM_BASE_URL` + `LITELLM_MASTER_KEY` on the API → boot catalog sync
   populates the cache (until then, static fallback = no regression).
3. iPhone Max-walk Round 4 (authenticated): STC preview, Code-Tab file nav,
   mobile icon bottom-row, code-tab live-edit, Vercel Öffnen → live page.
4. If Vercel still 404s: sprint-10-8/VERCEL_OPEN_FOUNDER_ACTION.md.

## Next sprint (10.9)
- Catalog auto-sync **cron** + monitoring on top of `syncFromLiteLLM()`
  (boot + admin endpoint already exist).
- Optional: backfill `discovered_models` for keys added before 10.8.

## Verification done / deferred
- Done (CDP/build): logo no green circle, public routes, prod build, typecheck.
- Deferred to founder (auth wall): authenticated onboarding + Code-Tab walk.
