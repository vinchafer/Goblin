# Sprint CHAT-IO — Report (pre-merge)

Branch `chat-io-2026-07-06` (5 commits ahead of `origin/master` @ `02555de`; 0 behind → rebase is a clean no-op).

## Commits
| SHA | Unit | Title |
|---|---|---|
| 56760da | R1 | fix(seo): correct sitemap domain |
| 8121521 | C1 | feat(chat): working dictation |
| 02646b8 | C2 | feat(chat): attachments reach the model |
| c9d0a39 | C3 | feat(chat): per-card add-to-project |
| 8986874 | C4 | feat(files): downloads in chat and files area |

## Static gates — GREEN (self-verified)
- **API suite:** `vitest run` → **348 passed / 35 files** (incl. new: 9 transcribe, 5 attachments, 1 createZip-trash).
- **tsc --noEmit:** clean on **apps/api** and **apps/web**.
- **Ledger:** M8 (dictation, platform COGS v1) + M9 (attachments, user-billed) committed with their units. Standing rule honored.
- **Diffstat:** 26 files, +1635/−100. Consumption-path changes = **only** the two new endpoints (`transcribe.ts`, `attachments.ts`), a one-line E7 prompt addendum, and the ledger. `model-router.ts` / `chat.ts` / `project-context.ts` are **untouched** — attachments ride the existing user-message path (no special path), exactly as scoped.

## Per-unit summary
- **C1 Dictation:** mic was a cosmetic stub (recorded nothing, discarded audio). Now: `useDictation` hook — live Web Speech on desktop/Android Chrome; MediaRecorder → `/api/transcribe` (Whisper via DeepInfra) fallback for iOS Safari. Transcript inserted at caret, never auto-sent. No textarea key interception (iOS native keyboard dictation preserved). Endpoint: size cap (15 MB / ~2 min), per-user daily cap 30, honest German errors, local mock without a key.
- **C2 Attachments:** were a text marker only. Now: text-class files read client-side; PDFs server-extracted (`unpdf`; scanned → honest "kein lesbarer Text"); images accepted with an honest no-vision note (F14-style, no faked vision). Content injected into the user turn; 24k attach budget with honest pre-send error (no silent truncation). E7 addendum clarifies attached content = user-inserted/visible.
- **C3 Per-card add-to-project:** file-cards had only Copy/expand. Added "Ins Projekt übernehmen" reusing the existing STC pipeline (opens the same `StcPreviewSheet` → P0.3 integrity + U2 GEÄNDERT/NEU/IDENTISCH; IDENTISCH starts unchecked = no dupe). Shared confirm helper extracted; project-bound → known target, standalone → picker.
- **C4 Downloads:** C4a per-card download (native format + MIME). C4b "Projekt als ZIP" (existing `/download` endpoint; `createZip` fixed to exclude `.trash/`, unit-proven). C4c "Als PDF speichern" on document cards → clean top-level `/print` view (Manrope, `@page` margins, no chrome) → browser/iOS print-to-PDF. No server-side PDF in v1 (deliberate).
- **R1:** sitemap `goblin.build` → `https://www.justgoblin.com` (only source ref).

## Honest limitations / gates NOT self-verified
The E2E specs are **authored** (`tests/e2e/43-46`) but **not executed** in this session:
- The Playwright specs are `@local-only` — they need the local dev servers (web+api), Supabase test-user auth (`loginAsRealTestUser`), and model/free-pool keys running. That harness was not brought up here.
- Several assertions are **model-dependent** (a real generating reply for the file-card in C3, content-fidelity in C2) → inherently the founder's local/CI run.
- **Real-iPhone dictation** (C1) is explicitly the founder's post-merge acceptance step.
- **375px/1440px screenshots** (C3/C4c) require a live browser run — not captured here (the print-view spec asserts no-overflow at 375 programmatically instead).

## Live E2E run attempt (option 3) — BLOCKED at auth, HALT
Brought the local harness up per the FEEL-2/2b recipe:
- **API** on :3001 with `GOBLIN_DEV_MODE=false` + `ALLOWED_ORIGINS=http://localhost:3100` — started clean ("Environment validation passed", listening on 3001).
- **Web** on :3100 — `next dev --turbo` (Next 16 default) **panics on globals.css** (the known Turbopack bug); switched to `next dev --webpack` → ready. Confirmed the browser targets the **local** API (temporarily pointed `apps/web/.env.local` `NEXT_PUBLIC_API_URL` → `http://localhost:3001`, `.next` cleared; verified no prod URL baked; restored afterward).
- Isolated run via a `.env.local`-loading Playwright runner, `PLAYWRIGHT_BASE_URL=http://localhost:3100`, project `local-only`.

**Blocker (verbatim):** `Error: Could not create or find test project` in `helpers/auth.ts:336`. Root cause: **the auth fixtures don't work in this environment.**
1. `loginAsRealTestUser` (admin magic-link) does **not** persist a session on :3100 — the browser stays on the public landing ("The cloud workshop for builders"); the local API only ever received `/health`, never an authed call. Consistent with `http://localhost:3100/auth/magic-callback` not being in the Supabase redirect allowlist / Site-URL for this project.
2. Probed the alternative `loginViaPasswordUI` (password creds present) → `TimeoutError: locator.fill: waiting for getByPlaceholder('your@email.com')` at `helpers/auth.ts:132` — the shared helper's **login selector is stale** (that placeholder no longer exists on the login page).

Both are **pre-existing test-harness / Supabase-config issues, independent of the C1–C4 code** — not a ≤1-commit product fix. Per the guardrail → HALT. Specs 43–46 are authored and correct; they will run once the local auth harness is repaired (add `:3100` to the Supabase redirect allowlist, or update the password-login selector) or against working CI. Harness torn down; `apps/web/.env.local` restored; tree clean.

## Live E2E — GREEN (resolved, option 3)
The auth blocker was resolved using the memory recipe (`goblin-local-e2e-browser`): the working local login is **`/auth/test-callback`** (admin `generate_link` → `verify` OTP → `setSession`), NOT the implicit magic-callback. Added reliable, DOM-independent fixtures (`resolveTestProjectId`, `createProjectChatSession`, `mintUserToken`, `seedProjectFile`) — the stale `openFirstProject`/`.project-row` selector was the real blocker (9C/9D shell moved projects to the sidebar; the composer lives at `/dashboard/chat/[id]`, not the project overview). Committed as `102bd05`.

Result on the local stack (api :3001 `GOBLIN_DEV_MODE=false`, web :3100 webpack):
- **43 (C1):** mic click → transcript in composer, NOT auto-sent (verified no message bubble carries it); native typing not swallowed. PASS.
- **44 (C2):** .md content enters the sent turn; 25k over-budget blocked with honest error; image → honest no-vision note. PASS ×3.
- **45 (C3):** real Groq generation → file-card → per-card übernehmen → StcPreviewSheet badge. PASS.
- **46 (C4):** "Projekt als ZIP" downloads a .zip (seeded file); print view renders cleanly at 375px (no overflow) + desktop. PASS ×2.

## Merge — DONE
Rebased onto `origin/master` (clean no-op) → `merge --no-ff` → pushed.
- **Merge SHA:** `a7a50c49ce6e944c58feb750a592af6ce4ff15cd` (`a7a50c4`)
- **Merge timestamp (TELEMETRY SEGMENTATION BOUNDARY):** `2026-07-04T13:13:58-10:00` — pre/post consumption boundary for the telemetry week.
- **Deploy verified:** both `/api/version` report the merge SHA — web (Vercel) `a7a50c49…` + api (Railway) `a7a50c49…`.
- **Prod deploy smoke (unauthenticated):** `POST /api/transcribe` → 401 (deployed), `POST /api/attachments/extract` → 401, `GET /api/projects/:id/download` → 401, `/print` → 307→/login (auth-gated, renders for logged-in users), sitemap serves `justgoblin.com` (R1). All new surface is live.

## Honest limitations (founder acceptance)
- **Authenticated prod interaction smoke** (one dictation attempt desktop, one .md attach+summary, one per-card übernehmen, one card download): **cannot be driven headlessly on prod** — prod `/login` is PKCE code-flow and `NEXT_PUBLIC_ENABLE_TEST_AUTH` is off in prod, so the test-callback self-login used locally does not work there (confirmed: test-callback → no `/dashboard`). These four are the **founder's acceptance step**, alongside **real-iPhone dictation** (C1). All four are fully E2E-verified against the identical build on the local stack.
