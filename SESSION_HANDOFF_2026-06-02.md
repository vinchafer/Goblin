# Session Handoff — 2026-06-02 (Sprint 10 close: the Convergence is built)

## State
Sprint 10 **COMPLETE** — all 6 convergence slices shipped as 6 atomic commits on
`master` (local, **NOT pushed**). Range `a45dcc6..e2aa57a`. Web production build
**PASS**; typecheck (web + api + shared) **PASS**. Full report: `SPRINT_10_COMPLETE_2026-06-02.md`.

## What shipped (one commit per slice)
- `cb60ca9` **Slice 1 Intent** — migration 0057, 4 intent cards in create form, "Layout wechseln" on hub, intent-driven first-paint foreground. (UI verified live.)
- `ce6842b` **Slice 5 Find/Replace + Multi-cursor** — wired @codemirror/search; freed Ctrl+D (was shadowed by copyLineDown) for multi-cursor.
- `078bca2` **Slice 2 Command Palette** — extended the existing ⌘K into a real dev registry (Navigate / This Project / Edit / Workspace / Appearance / Help). (UI verified live.)
- `a93aecb` **Slice 4 Git** — honest READ+WRITE: project-status endpoint + commit-message push to the linked repo + footer Git pill/panel. (No fake per-file staging — store is a Backblaze snapshot.)
- `738c2a4` **Slice 3 Multi-file** — wired CodeFileTabs into SessionPane (data model already supported multi-file; no migration 0058 needed).
- `e2aa57a` **Slice 6 Explorer ops** — move/folder backend endpoints + rename/new-file/new-folder/folder-delete UI. (UI verified live.)

## The constraint that shaped verification (READ THIS)
Local web → **prod Railway API** (`.env.local`) → **prod Supabase**. localhost client
calls are **CORS-limited** to prod, and the new code isn't deployed. So I verified
**pure-UI** features live on localhost and left **API/DB-bound** behavior (intent
persist, AI streaming, git ops, multi-file workspace, file-row ops) for the founder to
verify on prod after push+deploy. All features degrade gracefully pre-migration.

## Founder next steps (in order)
1. `supabase db push` (migration **0057** only — 0058 was intentionally not created).
2. Push the 6 commits + deploy web + api.
3. Walk Max (mobile, Landing Page) + Sofia (desktop, Web-App) on prod — fix anything CORS hid.
4. Confirm GitHub OAuth configured on prod (Slice 4 push depends on it).
5. Sprint 11: unify classic/multi-session Code Tab paths (#1 debt) · Repo Import (Slice 7) · session-linked tree (Slice 6 deferred half).

## Model status
Composer default = **Llama 3.3 70B (Groq)** confirmed on the dashboard (9.5 hotfix live).
Per the Sprint 10 brief preamble, the founder already verified all model paths work
after the SQL prefix fix; full 3-model re-verification needs a prod login (not done here).

---

# Session Handoff — 2026-06-02 (Sprint 9 close)

## State
Sprint 9 **COMPLETE**. 5 atomic commits on `master` (local, **not pushed**). Prior pushed HEAD was `1c0781d`. Web typecheck clean + production build exit 0.

## The one thing that matters (🔴 P0, carried + sharpened)
**The model is still broken on the default path.** Vincent's "Groq + Gemini both working" is half true:
- ✅ **Groq Llama 3.3 70B** works end-to-end.
- 🔴 **Gemini 2.5 Pro** (BYOK, marked ACTIVE, **onboarding-recommended**) → `400 LLM Provider NOT provided … model=google/gemini-2.5-pro` (wrong prefix; should be `gemini/`).
- 🔴 **Gemini 2.0 Flash** (free, **dashboard default**) → "Model not found in LiteLLM" (unregistered in proxy).

So a fresh user on the default/recommended path hits the exact Sprint-8 failure. Root cause = prod model catalog (DB rows added manually, not in repo seed) + LiteLLM proxy config. **Fix from prod DB/proxy or change new-user default to Groq — cannot fix from repo (B3 shield).** Everything else is secondary to this.

## What shipped (Sprint 9)
- **Phase 1:** Max fresh-signup account `vinc.hafner4@gmail.com` (no keys) + script `apps/api/src/scripts/create-max-test-user.ts`.
- **Phase 2:** three v2 persona audits + synthesis (run on prod, working Groq) — `DARIO/MAX/SOFIA_AUDIT_2026-06-02_v2.md`, `THREE_PERSONA_AUDIT_SYNTHESIS_2026-06-02_v2.md`.
- **Phase 3:** `CONVERGENCE_ARCHITECTURE_2026-06-02.md` (A–G) + 5 mockups in `sprint-9/convergence/`. Principle: **One Canvas, Progressive Reach** (intent sets foreground, gesture reveals depth, no mode).
- **Phase 4 (5 commits):** shortcuts overlay (?-toggle/touch-hidden/no auto-pop), `?session=` deep-link, hide `[E2E-TEST]` (filter on read), plain-German `friendlyError` mapper + DE app copy, dashboard E2E filter.

## Key facts for next session
- **CORS:** localhost:3000 cannot reach the prod Railway API → audits + live verification must run on **goblin-web.vercel.app**. For local code verification, run a dev API on :3001 and repoint `apps/web/.env.local`.
- Browser harness: clean typing into React inputs requires the **native value-setter** trick (`fill_input`/`type_text` double characters). Screenshot pixel coords are DPR-scaled (×0.8) vs viewport — prefer JS `.click()` by text.
- Multi-session Code Tab + File Explorer + deploy history are **live on prod** (migrations 0055 + 0056 applied).
- Test accounts: `vinc.hafner3@gmail.com` / `X45kLiM56D` (has Groq + broken Gemini keys); `vinc.hafner4@gmail.com` / `MaxBerlin#2026` (Max, no keys).

## Founder action list (ordered)
1. **🔴 Fix the model** (prefix fix or default-to-Groq) — unblocks the product.
2. Read + approve `CONVERGENCE_ARCHITECTURE_2026-06-02.md` (answer Section F).
3. Push the Sprint 9 commits.
4. Pick Sprint 10 slice order (rec: 1→5→2→4→3→6, defer repo-import).
5. Optionally delete Max test user `6642e2d4-…`.

## Beta-readiness
**~70% default path / ~90% working path** — split by one model bug. Fix the default model and the same product is ~90% beta-ready the same afternoon.

## Deliverables (repo root)
`SPRINT_9_WIP_2026-06-02.md`, `SPRINT_9_COMPLETE_2026-06-02.md`, `DARIO/MAX/SOFIA_AUDIT_2026-06-02_v2.md`, `THREE_PERSONA_AUDIT_SYNTHESIS_2026-06-02_v2.md`, `CONVERGENCE_ARCHITECTURE_2026-06-02.md`. Evidence + mockups in `sprint-9/` (max-signup/, audit-screenshots/, convergence/).
