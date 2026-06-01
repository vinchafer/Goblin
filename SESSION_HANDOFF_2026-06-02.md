# Session Handoff — 2026-06-02 (Sprint 8 close)

## State
Sprint 8 **COMPLETE**. 6 atomic commits on `master` (local, **not pushed**): `15dfaec` → `6480ffd`. Production build passes (exit 0). Branch `master`, prior pushed HEAD was `624da96`.

## What shipped (Sprint 8)
1. **Logo sweep** (`15dfaec`) — deleted old `GoblinMark`, all 12 callers → animated `GoblinLogo` states. Old logo gone everywhere (save/deploy/build/stream/load/404).
2. **Persistent Vercel link** (`a60dfd8`) — in-session Live-URL card (survives reopen) + hub URL list w/ copy+timestamp. Backend: `deployUrl` on session detail, `GET /:id/deployments`, deploy logs to `deployments` table.
3. **Daily dashboard** (`2cbf9b6`) — hub now Letzte Deploys/Chats/Code-Sessions + Aktivität/Dateien/URLs, responsive, server-queried.
4. **File Explorer** (`924b525`) — `/dashboard/project/[id]/files`: tree/preview/upload/download/delete, mobile. New file-storage + API endpoints.
5. **Undo/Redo** (`0ecbdc8`) — visible buttons, manual + AI (editor stays mounted across AI boundary).
6. **Live diff** (`6480ffd`) — jsdiff + CM decorations in streaming overlay for edits; guarded fallback.

Verified live: 5.1–5.4 fully; 5.5 manual fully; 5.5-AI + 5.6 by logic (see blocker).

## 🔴 BLOCKER carried into Sprint 9
**Test account has no working model** → "Model not found in LiteLLM" on any generation. Blocks live AI verification (5.5 AI-undo, 5.6 diff) AND is the #1 finding across all three persona audits — the core promise fails for a fresh trial user.

## Founder action list (ordered)
1. **Provision a model for trials** (default model or blocking BYOK onboarding) — P0, unblocks the product.
2. **Apply `supabase/migrations/0056_deployments.sql`** + **redeploy Railway API** → File Explorer + deploy-history go live in prod (currently latent; frontend degrades gracefully).
3. Env already reverted: `apps/web/.env.local` → prod Railway URL (I temporarily repointed to localhost:3001 for verification; restored).
4. Re-run 5.5-AI + 5.6 once a model is available.
5. Triage Sprint-9 backlog in `THREE_PERSONA_AUDIT_SYNTHESIS_2026-06-02.md`.

## Deliverables (repo root)
`SPRINT_8_WIP_2026-06-02.md`, `SPRINT_8_SELF_REVIEW.md`, `SPRINT_8_COMPLETE_2026-06-02.md`, `DARIO_AUDIT_2026-06-02.md`, `MAX_AUDIT_2026-06-02.md`, `SOFIA_AUDIT_2026-06-02.md`, `THREE_PERSONA_AUDIT_SYNTHESIS_2026-06-02.md`. Screenshots in `sprint-8/` (gitignored).

## Top Sprint-9 priorities (from audits)
P0 model fix · P0 migration+redeploy · P1 dismiss/repair shortcuts overlay + hide on touch · P1 unify EN/DE language · P1 scrub [E2E-TEST] data · P2 explorer rename/move · P2 plain-language microcopy · P3 git surface, deep-link, IDE-claim alignment.

## Env notes
- Chrome :9222 + dev server were down at start; I launched both (debug Chrome with repo `.chrome-debug-profile`, `pnpm dev`). 
- Next 16.2.6 turbopack dev shows intermittent ChunkLoadError/hydration warnings (dev only; prod build clean).
- A dedicated dev API runs on :3001 with prod Supabase + Vercel creds (via root load-env) — useful for verifying backend without Railway redeploy (repoint `apps/web/.env.local`).
