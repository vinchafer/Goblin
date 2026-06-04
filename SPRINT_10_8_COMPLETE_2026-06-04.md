# Sprint 10.8 — COMPLETE (2026-06-04)

Dynamic Catalog + Code-Tab Polish + Vercel fix. **11/11 items shipped.**
9 atomic commits (c8bc828 → d0773a9). typecheck (api+web+shared) PASS. Web prod
build PASS. Quality bar 9.5.

## Phase 0 ✓
localhost:3000=200 · Chrome :9222 launched (Chrome/148) · origin synced ·
Max-walk verbatim saved.

## Phase A — Dynamic Catalog (architectural)
- **10.8-1** `services/catalog.ts` — `syncFromLiteLLM()` pulls `/v1/models`,
  derives provider/slug/caps, upserts the `models` table as a CACHE. Boot sync
  (fire-and-forget) + `POST /api/admin/catalog/sync`. Defensive: empty/failed
  response never wipes the cache. Migration 0061 (idempotent).
- **10.8-2** `services/provider-discovery.ts` — on key-add, queries the provider's
  own `/models` with the user's key; caches `byok_keys.discovered_models`. Handles
  Anthropic, Google (v1beta), OpenAI-compat. `[]` on failure → catalog fallback.
- **10.8-3** `getCatalogForUser()` is the single read path: synced cache ∩ per-user
  discovery. connected+discovered → real list; connected+no-discovery → cached/static;
  not-connected → curated static (greyed). Non-chat models (embeddings/whisper/tts/
  image) filtered. Grep audit: remaining hardcoded slugs are pricing tables, the
  documented fallback, and intentional defaults (TRIVIAL_FIXES_10_8.md).
- **10.8-4** ProviderKeyForm: provider-first copy + post-connect panel listing the
  live discovered models ("Verbunden — N Modelle verfügbar").

## Phase B — Code-Tab Polish (Vincent's dedicated ask)
- **10.8-5** `StcPreviewSheet` — preview before Send-to-Code: file list w/ checkboxes,
  language + line count, NEU/Überschreibt badge, target-project dropdown (no-project
  chat). Wired into both STC paths + multi-file sessionStorage replay. (Max-walk #1)
- **10.8-6** Code-Tab action rows collapse to **icon-only, 44px** tap targets under
  640px; long status line hidden; desktop keeps labels. (Max-walk #2, 3rd mention)
- **10.8-7** `SessionFileNav` — slide-in panel listing ALL session files (filter,
  tap-to-open, draft dot, + new file). Files icon in the editor bar. (Max-walk #3)
- **10.8-8** Code-Tab chat now passes the active file path; backend marks it
  AKTUELL GEÖFFNET and instructs edit-in-place (same path) → the existing
  StreamingDiffView lights up + draft Sichern/Verwerfen = accept/reject. Root cause
  of the "new style.css instead of editing" confusion. (Max-walk #4)

## Phase C — Vercel + verify
- **10.8-9** Root cause of the recurring "Öffnen → SSO → 404": deploy returned the
  protection-gated deployment **hash url** (alias empty at POST time). Now polls
  until the public **production alias** is assigned and returns that; `?debug=1`
  surfaces both URLs. Founder-action doc covers Deployment-Protection=All. Goblin
  sends NO token in the URL (hypothesis ruled out). (Max-walk #5)
- **10.8-10** CDP verify: GoblinLogo no green circle ✓, public routes render,
  prod build green. Authenticated 10.7/10.8 surfaces deferred to founder Max-walk
  (auth-wall boundary; no test password; credentials-from-screenshots prohibited).
- **10.8-11** This report + handoff + push.

## Migration (founder applies — idempotent)
`supabase/migrations/0061_dynamic_catalog.sql`:
- models: +discovered_via, +last_synced_at, +capabilities, +idx
- byok_keys: +discovered_models, +last_validated_at

## Founder actions
1. Apply migration 0061.
2. (10.8-1/2 latent until applied — discovery columns; graceful no-op before.)
3. Set `LITELLM_BASE_URL` + `LITELLM_MASTER_KEY` on the API for catalog sync to
   populate (else static fallback remains — no regression).
4. Vercel "Öffnen": if still walls after deploy, see
   sprint-10-8/VERCEL_OPEN_FOUNDER_ACTION.md (Deployment Protection → preview-only).
5. iPhone Max-walk Round 4 — authenticated check of STC preview, Code-Tab nav,
   icon bottom-row, code-tab live-edit, Vercel Öffnen.

## Known limits / latent
- Discovery only fills after migration 0061 + a fresh key-add (existing keys get
  discovered on next add; a backfill could be a 10.9 task).
- Catalog cron (scheduled re-sync) is Sprint 10.9 — boot + admin endpoint only here.
- Mobile-specific CDP shots blocked by a harness viewport-override warning; logo/
  no-regression checks are width-independent.
