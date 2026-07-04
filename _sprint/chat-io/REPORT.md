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

## Merge decision — HALT (awaiting go/no-go)
The founder's merge authorization is **conditional on all unit-gate evidence being present**. The static gates are green, but the **live E2E evidence is not** (authored, not run) and the merge deploys to prod (Vercel + Railway) — an irreversible outward action. I am **not** auto-merging on unverified live gates.

**To proceed, either:**
1. Run the E2E suite locally/CI (`PLAYWRIGHT … 43-46 @local-only`) and confirm green, then I rebase (no-op) + `merge --no-ff` + push + verify both `/api/version` on the merge SHA + prod smoke; **or**
2. Explicitly authorize merge on static gates + authored specs (accepting live E2E as post-merge verification).

**Telemetry segmentation boundary** (to record at merge): the merge SHA + exact merge timestamp mark the pre/post consumption boundary for the running telemetry week. Not yet set — no merge performed.
