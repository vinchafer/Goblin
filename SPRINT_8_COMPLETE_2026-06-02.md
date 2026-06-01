# Sprint 8 — Completion Report

**Date:** 2026-06-02
**Headline:** ✅ **COMPLETE** — all 6 items shipped as atomic commits; production build passes. Two AI-streaming-dependent verifications are blocked by a test-account model outage (documented, not a code defect).

---

## 1. Per-item status

| # | Item | Status | Commit | Live-verified |
|---|------|--------|--------|---------------|
| 5.1 | Logo Sweep (kill old GoblinMark) | ✅ Done | `15dfaec` | Yes (404 new logo; grep clean) |
| 5.2 | Persistent Vercel link | ✅ Done | `a60dfd8` | Yes (session card + hub list + API) |
| 5.3 | Hub → daily dashboard | ✅ Done | `2cbf9b6` | Yes (desktop + mobile) |
| 5.4 | File Explorer | ✅ Done | `924b525` | Yes (CRUD + preview + mobile) |
| 5.5 | Undo/Redo | ✅ Done | `0ecbdc8` | Manual: yes. AI-edit: by-logic (model blocked) |
| 5.6 | Live diff during streaming | ✅ Done | `6480ffd` | Logic verified in node; live visual blocked (model + route hydration) |

Commits: **6** functional (`15dfaec` → `6480ffd`), all local on `master`, **not pushed** (per constraint).

## 2. Live verification evidence (sprint-8/)
- `logo-inventory.txt`, `logo-sweep/404-newlogo.png`
- `vercel-link/hub-urls.png`, `vercel-link/session-livecard-final.png`
- `dashboard-hub/desktop.png`, `dashboard-hub/mobile.png`
- `file-explorer/desktop.png`, `preview.png`, `upload.png`, `after-delete.png`, `mobile.png`
- `undo-redo/before.png`, `typed.png`, `after.png` (+ verified type→undo→redo via DOM assertions)
- `live-diff/streaming.png` (isolation route — did not hydrate; logic verified in node instead)
- `full-walk/00-login.png`, `01-code-tab.png`, `mk-landing.png`

## 3. Self-review summary
See `SPRINT_8_SELF_REVIEW.md`. 4/6 items verified end-to-end live; 5.5-AI and 5.6 verified by component logic because the **test account has no working model** ("Model not found in LiteLLM"). All AI-dependent flows are blocked the same way — this is the sprint's main verification gap and the audits' #1 finding.

## 4. Backend changes (latent until founder acts)
- **Migration `0056_deployments.sql`** — additive, RLS-gated deploy-history table. All reads/writes degrade gracefully to `projects.preview_url` if not yet applied.
- New API endpoints (apps/api): `GET /:id/deployments`, `GET /:id/files-tree`, `GET /:id/files-raw/*`, `POST /:id/files/upload`; enriched `GET /code-sessions/:id` (deployUrl), deploy logs a deployments row.
- These live on the LOCAL api and were verified by repointing the web to it. **On prod they are latent until the founder redeploys Railway + applies 0056.** Frontend works today against prod via graceful fallbacks (URLs show latest preview_url; File Explorer / deployments need the redeploy).

## 5. Founder action list
1. **Fix the model outage** — the trial account cannot generate ("Model not found in LiteLLM"). Either restore a default platform model for trials or make BYOK setup unmissable. **Without this, the core promise is broken for new users.** (Highest priority — all three personas fail here.)
2. **Apply migration `0056_deployments.sql`** to Supabase, then **redeploy Railway API** so the new endpoints (File Explorer, deploy history) go live in prod.
3. **Revert the dev repoint:** `apps/web/.env.local` line 3 is temporarily `http://localhost:3001` — set back to `https://goblinapi-production.up.railway.app`.
4. Re-run the AI-dependent verifications (5.5 AI-undo, 5.6 live diff) once a model is available.
5. Triage the three-persona audit findings (below) into Sprint 9.

## 6. Open / deferred
- 5.5 AI-edit-undo + 5.6 live-diff visual: unproven live (model blocked).
- Code-session `?session=` deep-link not honored.
- Explorer rename/move/folder-ops (MVP scope).
- KEYBOARD SHORTCUTS overlay persistence (UX clutter).
- 58 [E2E-TEST] projects (test-data hygiene).
- EN marketing ↔ DE app language inconsistency.

## 7. Environment notes
- Web (dev) on Next 16.2.6 turbopack; intermittent ChunkLoadError / hydration warnings in dev only. **Production build: exit 0** (`.next-build` artifacts generated, incl. new /files route).
- Chrome 9222 + dev server were down at Phase 0; I started both myself (documented in WIP).
