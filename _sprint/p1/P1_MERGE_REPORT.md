# Sprint P1 — Polish Pass · Merge Report

**Merge SHA:** `e2179a2691801c8819d08dfe15b552c29cdf9fce` (`e2179a2`, merge `--no-ff`)
**Branch:** `p1-polish-2026-07-08` (from master `3f2e0f6`) → master
**Date:** 2026-07-08

## Final checks
- **Suites green:** api vitest **364 passed** (39 files), web vitest **2 passed**.
- **tsc clean:** apps/web ✅, apps/api ✅.
- **Consumption paths untouched except P1.8:** the only api / billing / ledger
  changes are the P1.8 measurement fields — `track-completion.ts` (ttft_ms /
  duration_ms, tolerant insert), `model-router.ts` (timing instrumentation only,
  no token/cost/control-flow change), `GOBLIN_CONSUMPTION_LEDGER.md` (note),
  `migrations/0080`. Verified in the diffstat.
- **Dark-mode spot-check (3 surfaces):** dashboard, chat (+ code card), settings
  modal all render dark with no cream surface under dark text — see
  `_sprint/p1/evidence/p11-*.png`, `p11-chat-messages-dark-1440.png`.

## Migration flag
- **`supabase/migrations/0080_completion_costs_timing.sql` — AUTHORED, NOT APPLIED.**
  Adds `ttft_ms` + `duration_ms` to `public.completion_costs`. Idempotent,
  pre-migration-tolerant (like 0077): the API writes degrade gracefully when the
  columns are absent. Founder applies via the Supabase SQL editor. Telemetry for
  these two fields stays inert until then.

## Per-unit summary (commit · evidence)
- **P1.1** `a74693d` — dark mode completed over Chat/Dashboard/modals. Root cause
  was systemic: `--surface`/`--surface-page`/body used `--paper` (a locked light
  anchor) and the dashboard's scoped `.gobl-dash` surface set never flipped.
  Ev: `p11-dashboard-dark-{375,1440}.png`, `p11-createmodal-dark-*`, `p11-settings-dark-*`, `p11-chat-messages-dark-1440.png`.
- **P1.2** `2aeb7cb` — command bar → auto-grow textarea; "Goblin arbeitet… <n>s"
  working state; "Goblin hat <n> Dateien geändert" change pop-up. Ev: `p12-phase{1,2,3}-*-375.png`.
- **P1.3** `57e9bf6` — draft-aware live state: "Live · älterer Stand …" + neutral
  Öffnen while drafts pending, green + "Live · aktuell" after publish. Ev: `p13-state{A,B}-*-375.png`.
- **P1.4** `0c39436` — "Ins Projekt übernehmen" on filename-less document cards
  (derived .md name, same STC pipeline + NEU badge). Ev: `p14-*`.
- **P1.5** `2f920d9` — drag&drop + paste attachments into the C2 path. Ev: `p15-{dropped,pasted}-chip.png` (highlight code-verified; Chromium nulls dataTransfer on synthetic DragEvents).
- **P1.6** `0232495` — honest mic permission: denied → specific unblock hint,
  pending indicator, granted proceeds. Ev: `p16-mic-{denied,granted}.png`.
- **P1.7** `61c8c6d` — badge base loader: concurrency pool + bounded 429 retry;
  a 429-past-budget base is UNKNOWN (neutral), never a permanent NEU. Ev: `project-files.test.ts` (2 passed).
- **P1.8** `2b55359` — ttft_ms + duration_ms measurement (migration 0080). Ev: `track-completion.test.ts` (in api 364).
- **P1.9** `175cbed` — connectors page explains itself (what/steps/eta) + honest
  disabled "Bald" cards (Supabase/Stripe/Domain, not focusable). Ev: `p19-connectors-{de,en}-{375,desktop}.png`.
- **P1.10** `180b07a` — retry transient 429 on project load; "Kontingent 0 %
  verbraucht" unambiguous. Ev: `p1-10-diagnosis.md`, `p110-sidebar-{de,en}.png`.
- **P1.11** `1dfcfde` — publish-moment Vercel JIT (no dead end): detect missing
  connection before deploy → inline connect → resume publish. Ev: `p111-{jit-sheet,publish-resumed}.png`.

## Prod verification
- `/api/version` (Railway api): polled for the merge SHA post-push (Railway +
  Vercel redeploy on push). See session log.
- Prod interaction smokes are founder acceptance (prod `NEXT_PUBLIC_ENABLE_TEST_AUTH`
  is off → no self-auth); verified transitively.
