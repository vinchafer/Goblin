# FEEL-2 "Memory & Truth" — Sprint Report

Branch `feel-sprint-2-2026-07-03` · Report written 2026-07-04 (resume session; prior session died at usage limit mid-verification, PC rebooted). Implementation was complete and committed before the crash; this session assessed state, completed verification, and produced this report. **No merge, no deploy. Migration 0076 NOT applied.**

## Phase 0 — state assessment (details: `reverify/RESUME_STATE.md`)

- Working tree clean; all four unit commits present on the branch (`5cbfc3f` U0, `b7ad88b` U1, `dfabe15` U2, `65f95cd` U3). No uncommitted unit work. Untracked `walk-evidence/` (unrelated prior-session artifacts) left untouched.
- API tests: **320/320 green**. Web `tsc --noEmit`: clean. API `tsc --noEmit`: clean (no `typecheck` script in api package.json).
- `DEEPINFRA_API_KEY` absent everywhere → founder revoked it after FEEL-1, as instructed. Consequence: all Swift-gated probes BLOCKED (rule 4; no BYOK substitution). U0/U2 E2E ran on the free local routing (Groq `llama-3.3-70b-versatile`) — those units test UI behavior, not a Swift gate.
- Ticket **#17** filed: Turbopack panic on `next dev` (Next 16 defaults to Turbopack; PostCSS panic reproduced this session). Dev-only; `next dev --webpack` works and was used throughout. https://github.com/vinchafer/Goblin/issues/17

Local verification stack: API :3001 (`GOBLIN_DEV_MODE=false` for the probe runs only — ticket #14 — plus `ALLOWED_ORIGINS=http://localhost:3100`, needed because the API's CORS allowlist only carries :3000), web :3100 (webpack), isolated Chrome on :9222, test account `vinc.hafner3@gmail.com` via admin-magiclink cookie injection. Root `.env.local` was not modified.

## Units

| Unit | Commit | Status | Evidence |
|---|---|---|---|
| U0 auto-scroll release | `5cbfc3f` | **Verified (E2E, 375px)** | `reverify/U0_*.png` |
| U1 file-content injection | `b7ad88b` | **Verified deterministically; Swift probes BLOCKED** | `reverify/U1_probe1-3.txt`, `U1_deterministic_capture.txt` |
| U2 STC change manifest | `dfabe15` | **Verified (E2E, 375px + 1440px)** — 2 findings | `reverify/U2_*.png` |
| U3 rolling project memory | `65f95cd` | **Partially verified; live probe BLOCKED** — 1 finding | `reverify/U3_probe.txt`, `U3_deterministic_capture.txt` |

### U0 — chat auto-scroll releases on scroll-up
During a live Groq stream at 375px: scrolling up **holds the reading position while tokens keep streaming** (U0_11 vs U0_12 identical position, stop-button visible), the **"↓ Zum Ende" chip appears** (U0_11), and **tapping it jumps to the end and removes the chip** (U0_19; also U0_14 during an active request). Tap-resume re-arms live-follow structurally: the chip's `scrollToBottom` sets `followRef=true`, so every subsequent token re-pins (`useStickToBottom.ts:41-53`); a fully-streaming tap-then-follow capture wasn't repeatable because Groq's 12k-TPM free tier throttled successive long generations. Both chat surfaces use the shared hook (commit touches standalone chat + workspace ChatMessages).

### U1 — project file contents in the chat system prompt
Swift probes 1–3 **BLOCKED** (no DeepInfra key; see U1_probe1-3.txt). Deterministic verification of every mechanical claim, run against the real habit-tracker project through the real loader:
- `index.html` injected **byte-identical** to the stored copy (5,460 chars, `identical=true`).
- `daten.json` (60 KB > 48k-char budget) not loaded, carries the honest **"(Inhalt nicht geladen — zu gross)"** marker in the built prompt.
- E7 rescope in place: loaded/in-chat files may be shown & quoted; the fabrication ban remains for not-loaded/binary/unlisted files.
- Supplementary (non-Swift): llama with the injected context reproduced the real `index.html` changing only the requested heading (single-hunk +1 −1 diff, U2_06) — impossible without the real content in context.

**Token cost (founder review):** habit project system prompt is 18,733 chars (~4.7k tokens) with injection vs 7,456 chars (~1.9k tokens) without → **injection delta ~2.8k tokens** on this project. Live corroboration: Groq rejected the habit-project request at 12,975 total request tokens (free-tier TPM 12,000) — worth knowing that content injection can push small-model free tiers over per-request limits.

### U2 — Send-to-Code change manifest with per-file diffs
Full E2E in a seeded mini project (index.html + style.css), 375px and 1440px:
- Chat file-card shows **"ändert index.html · +1 −1"** during/after the response (U2_01); an identical file gets no change line.
- STC modal classifies **GEÄNDERT +1 −1** with per-file **diff preview** rendering correctly at both widths (U2_06 mobile bottom-sheet, U2_07 desktop dialog) — unified hunk shows exactly the heading swap.
- **IDENTISCH**: file badges IDENTISCH, starts **unchecked**, and with nothing else selected the send button is disabled ("Auswahl senden (0)") — U2_14 desktop, U2_15 mobile.
- Filename-integrity guard (P0.3) triggered incidentally and works: llama named the CSS `styles.css`; the modal flagged the mismatch and offered "Automatisch umbenennen (styles.css → style.css)".
- Confirmed send lands the files in the Code workspace as an **Entwurf** ("Nicht veröffentlichte Änderungen", Sichern/Veröffentlichen pending) — U2_09b. Server files intentionally unchanged until "Sichern"; verified via API.

**Findings (not fixed — verification session):**
- **F1**: After the integrity auto-rename, the badge does **not** reclassify — `StcPreviewSheet` keys `statuses` by the original path, so a renamed `styles.css → style.css` stays **NEU** even when the target `style.css` exists and is identical (U2_05). Classification itself is correct for unrenamed paths (proved by F1-workaround test U2_14).
- **F2**: The chat card's "ändert … · +n −m" line renders live but is **gone after a page reload** (verified twice on chat 9f747d76 with unchanged server files). Live-only computation; the manifest line should survive reloads.

### U3 — per-project rolling memory
Live "Wo waren wir?" probe **BLOCKED** twice over: migration 0076 not applied anywhere reachable, and the summarizer can't complete locally (F3). Verified instead (details U3_probe.txt):
- **Pre-migration clean no-op verified live**: every chat this session ran against prod Supabase without the `project_state` table — zero user-visible errors, only the designed `[project-state] summarizer errored:` console warns. Guards in `project-state.ts` return null/log-and-return on every failure path.
- **Prompt injection verified deterministically**: with state present the prompt renders "- Bisheriger Stand & Entscheidungen: / Stand: … / Entscheidungen: …"; without state the section is absent and the prompt explicitly instructs honest "no stored state" answers, no invented history.
- API suite (incl. U3-adjusted tests) green.

**Finding F3**: the async summarizer calls `streamCompletionGuarded` without an explicit model; local free-key routing resolves to slug `llama-3.3-70b` and 404s ("model does not exist") on every turn. Harmless to users (silent path) but the feature will never populate state in an environment where the default slug doesn't resolve — worth pinning the summarizer to a known-good cheap model or verifying the default resolves on Railway.

## For the founder

1. **Migration 0076** (`supabase/migrations/0076_project_state.sql`) is authored and committed but **NOT applied** — apply via Supabase SQL Editor when ready. Pre-migration behavior is a verified clean no-op.
2. **DeepInfra key**: already revoked (confirmed absent). If you want the blocked Swift gates (U1 probes 1–3, U3 live probe) run properly, either re-issue a scoped key for one session or verify on Railway prod where hosted routing exists — then revoke again.
3. Open findings to triage: **F1** (STC rename doesn't reclassify), **F2** (change line lost on reload), **F3** (summarizer model slug), plus ticket **#17** (Turbopack dev panic).
4. U1 cost: ~+2.8k input tokens per chat turn on a typical small project (budget-capped at ~12k tokens worst case).

## Test residue

- Projects `[E2E-TEST] Habit Tracker FEEL2` (pre-existing) and `[E2E-TEST] FEEL2 U0U2 Mini` (created this session; contains an unsaved Code-workspace draft) remain on the test account; `styles.css` test artifact was deleted (trashed).
- `GOBLIN_DEV_MODE=false` was inline-env only for the probe API process; `.env.local` untouched (`GOBLIN_DEV_MODE=true` on disk throughout).

---

# FEEL-2b — Fix-Wave (reverify session 2026-07-05)

The four FEEL-2 findings (F1/F2/F3 + the Groq free-tier token-limit note) were fixed on branch `feel-sprint-2-2026-07-03` and re-verified. API suite **327/327 green**, `tsc --noEmit` clean (api + web).

## Fixes (one isolated commit each)

| ID | Commit | Addresses | Summary |
|----|--------|-----------|---------|
| B1 | `fe929f5` | F3 | Pin the project-state summarizer to `goblin/efficient` — the default slug 404'd on local free-key routing, silently never populating state. |
| B2 | `8de5b4b` | U1 Groq note | `streamWithReducedContextRetry`: on a pre-content provider token-limit rejection (Groq TPM/413, OpenAI context, Anthropic prompt-too-long), retry ONCE with file contents stripped to names+sizes + honest German note. 7 unit tests. |
| B3 | `39a0266` + `556285a` | F1 | Reclassify STC badge after the integrity auto-rename (two bugs — see below). |
| B4 | `56ddedc` | F2 | Persist the chat file-card change line per assistant message id (localStorage `goblin:chat-change-notes`) so it survives reload. |

### B3 — two bugs found & fixed during E2E
The original F1 ("rename doesn't reclassify") was **two** defects, both surfaced only by running the flow end-to-end:
1. **Wrong lookup key** (`39a0266`, `StcPreviewSheet.tsx`): status + diff were keyed by the **original** outgoing path, so a `styles.css -> style.css` rename left the badge stuck on **NEU**. Fixed to key by the **effective (renamed)** path.
2. **Missing target content** (`556285a`, `standalone-chat.tsx`): even keyed correctly, the preview only fetched the **outgoing** file paths — the rename **target**'s content was never loaded, so the comparison lookup was empty and the badge still read NEU. Fixed to load **all** project text files (`fetchAllTextFiles`, capped at 30) before opening the preview, so any rename target is comparable.

## Gate results

- **G1.1 (U1 Swift probe 1)** — PASS. `goblin_hosted` / `goblin/efficient` confirmed; injected `index.html` byte-compared vs stored copy (identical). Tokens up 4'866 down 1'534. Evidence: `U1_swift_probe1.txt`.
- **G1.2 (U1 Swift probe 2)** — PASS. File preserved; diff vs stored = 2 lines (`<h1>` + `<title>`). Observed note: the model mirrored the new heading into `<title>` as well — recorded as observed, acceptable. Evidence: `U1_swift_probe2.txt`.
- **G1.3 (U1 Swift probe 3, over-budget file)** — PASS. `Zeig mir daten.json.` -> honest not-loaded answer: "der Inhalt ist nicht in meinen Kontext geladen — die Datei ist 59 KB gross und wird als 'zu gross' markiert", explicitly refusing to fabricate ("keinen erfundenen Inhalt ausgeben — das waere nicht korrekt"). Zero fabricated content. Tokens up 5'020 down 165. Evidence: `U1_swift_probe3.txt`.
- **G2 (U3 end-to-end)** — PASS. Chat 1 stored the decision live: `project_state` row `decisions` = "...dauerhaft unter dem festen localStorage-Schluessel 'gob_habits_v2' als ein JSON-Objekt..." (row captured, `updated_at 2026-07-03T20:07:22Z`). NEW chat, same project, "Wo waren wir?" -> answer reflects the **real stored** decision (names `gob_habits_v2`, the single JSON object, defaults `darkMode='system'/notifications='disabled'/language='de'`) AND honestly flags it is "noch nicht im Code vorhanden" — no invented history. Evidence: `U3_swift_probe.txt` (+ `U3_swift_probe_chat1.txt`).
- **G3 (B2 live, real Groq free key)** — PASS. daten.json (59 KB) is dropped as over-budget, so the plain project only injects ~11 KB (~2.5k tokens) — under Groq's 12k TPM. Condition forced per plan by adding a token-dense 34 KB JSON file that fits the 48k-char budget and IS injected. First request = **28'645 tokens -> Groq 413** ("tokens per minute (TPM): Limit 12000, Requested 28645"); `isTokenLimitError` matched; B2 retried ONCE with reduced context (names+sizes + `REDUCED_CONTEXT_NOTE`) -> stream **succeeded**; answer fabricated no file contents. The two `meta` events in the SSE are the attempt->retry transition; done at 2'550 tokens = the reduced request. Evidence: `B2_groq_fallback_sse.txt` (SSE + verbatim server-log 413).
- **B3 E2E** — PASS. `styles.css -> style.css` auto-rename flips the badge **NEU -> IDENTISCH**. Evidence: `B3_01_before_rename.png`, `B3_02_after_rename.png`.
- **B4 E2E** — PASS. Live revision rendered "aendert index.html · +1 -1"; after a hard reload the line re-rendered **identical** from the persisted store (before == after == `aendert index.html · +1 -1`). Evidence: `B4_01_live_change_line.png`, `B4_02_after_reload.png`. (Run pinned the chat model to Goblin Swift: the keyless Groq default hits its 12k TPM on this project — the very case B2 handles — and its reduced-context retry strips the file contents the model needs to emit the full file. Swift has no such cap. This is an E2E-harness choice, not a B4 change.)

## Updated token counts
- U1 injection on the habit project: system prompt ~18.7k chars (~4.7k tokens) with injection vs ~7.5k chars (~1.9k tokens) without -> **~2.8k-token delta** per turn (budget-capped at ~12k tokens / 48k chars worst case).
- Swift turns on this project: up 4.8-5.0k input tokens.
- B2 trigger reproduced deterministically at **28'645** request tokens (dense 34 KB injected) -> 413 -> reduced to **2'550**.

## Consumption ledger (`docs/GOBLIN_CONSUMPTION_LEDGER.md`) — ADDED (commit `[L1]`)

Added from the founder's copy (`04 - Financials_Machbarkeit/GOBLIN_CONSUMPTION_LEDGER.md`) as its own commit `docs: consumption ledger v1 [L1]`, with all VERIFY-PATH cells resolved and the M3 accounting verified against the live code. Resolved locations:

- **FORGE_WEIGHT** = `4.4` -> `apps/api/src/lib/goblin-cap.ts:48` (derived `0.715 / 0.162`, Forge ~4.4x Swift per token).
- **COST_UNITS_PER_BUILD** = `150_000` -> `apps/api/src/lib/goblin-cap.ts:84` (1 build ~0.15M cost units ~150k Swift / ~34k Forge tokens).
- **Monthly allowance table** -> `GOBLIN_MONTHLY_ALLOWANCE` `goblin-cap.ts:55`; default (trial) `GOBLIN_DEFAULT_ALLOWANCE = 4_900_000` `:68`. Formula `cost_units = swift_tokens + forge_tokens x FORGE_WEIGHT` (header, `goblin-cap.ts:10`).
- **Allowance accounting / history window** -> `goblinWeightedUsage()` `apps/api/src/services/model-router.ts:275-306`: one month-scoped read of `completion_costs` filtered `user_id` + `source_tier='goblin_hosted'`, summing `tokens_in + tokens_out`, split Swift vs Forge by `model === 'goblin/premium'` (Forge), for the calendar month and the current day. Allowance gate at `model-router.ts:~501` (`allowance_reached`); usage is written by `trackCompletion()` at `model-router.ts:566`. Chat history window = last **50** messages (`chat-sessions.ts:174`).

### M3 — is the summarizer billed to the user's allowance? (what the code ACTUALLY does)
**It IS billed.** `updateProjectState()` (`project-state.ts:86`) calls `streamCompletionGuarded({ userId, projectId, modelPreference: 'goblin/efficient', ... })` with the **real userId** and the goblin_hosted Swift tier. That path (a) is subject to the allowance gate — a user at their cap has summarization silently rejected — and (b) records a `completion_costs` row via `trackCompletion` (`model-router.ts:566`) that `goblinWeightedUsage` sums into the user's **monthly Swift usage**. There is **no exemption / system-user bypass** for the background summarizer. If M3's intent is that rolling-memory summarization must NOT consume user allowance, that is a **gap** (fix would be a dedicated non-billed path or a system userId) — flagged, not silently changed.

## For the founder
1. **DeepInfra key**: the scoped key is to be **revoked after this run** (per plan). Swift gates G1/G2/G3 above were captured while it was live.
2. **Consumption ledger**: added as `docs/GOBLIN_CONSUMPTION_LEDGER.md` (commit `[L1]`) with VERIFY-PATH cells resolved. **Action needed:** M3 verified as billing-to-user (see item 3); M4's per-build 150k charge site is still VERIFY-PATH (not located this pass).
3. **M3 gap**: summarizer tokens currently DO count against the user's monthly Swift allowance (see above) — decide whether that is intended.
4. Migration **0076** (`project_state`) status unchanged from the FEEL-2 report — confirm it is applied in prod before relying on U3 live.

## Test residue (FEEL-2b)
- Test-account project `[E2E-TEST] Habit Tracker FEEL2` (`99e9238c...`) gained transient chat sessions (B4/G3) and a temporary `big.json` (G3) that was **purged** (hard delete verified — files back to `daten.json, index.html, script-1.js, script.js`).
- Local `GOBLIN_DEV_MODE=false` + `ALLOWED_ORIGINS=http://localhost:3100` were inline-env on the probe API process only; `.env.local` untouched on disk.
