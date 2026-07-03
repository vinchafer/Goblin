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
