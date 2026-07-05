# GOBLIN CONSUMPTION LEDGER
**The consumption blueprint (Verbrauchs-Bauplan). v1.0 · 2026-07-04 · Author: Steven · Repo target: `docs/GOBLIN_CONSUMPTION_LEDGER.md`**
**VERIFY-PATH cells + M3 accounting resolved by CC 2026-07-05 (FEEL-2b reverify). Resolutions cite code at that commit — re-confirm line numbers if the files move.**
**I0 (MOBILE-1, 2026-07-07): measurement-only changes — `completion_costs` now attributable project-vs-standalone (`chat_session_id` + `project_id`, migration 0077); `platform_events` table (0078) gives A20/B2 a DB twin of the platform_cogs/context_retry log lines. No token consumption changed. Migrations 0077/0078 authored, NOT applied — founder applies. See M2/M3.**

## Purpose & standing rule

Every mechanism that consumes model tokens (user-billed or platform-paid) is registered here with: trigger, token formula, tuning knob + code location, dollar cost, and the CFO-dashboard figure that depends on it. **Standing rule (founder decision 2026-07-04): any code change that alters token consumption must update this ledger in the same commit.** Steven includes this rule in every CC prompt that touches consumption. After consumption-relevant merges: ~1 week of prod measurement, then reconcile against `GOBLIN_CFO_DASHBOARD_DE.html` (the financial source of truth).

**Verification status legend:** MEASURED (real capture, date noted) · FORMULA (derived from code constants) · ASSUMED (needs telemetry) · VERIFY-PATH (code location to be confirmed by CC before repo commit) · VERIFIED (code location confirmed, date noted).

---

## Unit system (the common currency)

| Constant | Value | Where | Status |
|---|---|---|---|
| Cost unit | 1 unit = 1 Swift-token-equivalent | product-wide | — |
| FORGE_WEIGHT | 4.4 (1 Forge token = 4.4 units; = price ratio $0.715/$0.162) | `apps/api/src/lib/goblin-cap.ts:48` (`export const FORGE_WEIGHT = 4.4`); weighting applied in `weightedCostUnits()` `goblin-cap.ts:137` (`swift + forge * FORGE_WEIGHT`) | VERIFIED 2026-07-05 |
| Unit price (platform cost) | $0.162/M best (Swift cached) · $0.20/M realistic mix · $0.283/M worst (no cache) | Dashboard "Effizienzklasse" (A8) | MEASURED (prices 2026-06-10) |
| COST_UNITS_PER_BUILD | 150k units per build (reconcile job) | `apps/api/src/lib/goblin-cap.ts:84` (`export const COST_UNITS_PER_BUILD = 150_000`); web mirror `apps/web/lib/plan-builds.ts` (derives, never hardcodes) | VERIFIED 2026-07-05 |
| Plan allowances (Tier 1) | Trial ≈4.9M · Build 17.4M · Pro 30M · Power 61.7M units/mo | `GOBLIN_MONTHLY_ALLOWANCE` `apps/api/src/lib/goblin-cap.ts:55-64` (none/trial 4_900_000 · build 17_400_000 · pro 30_000_000 · power 61_700_000); default `GOBLIN_DEFAULT_ALLOWANCE = 4_900_000` `:68`; resolver `monthlyAllowanceForPlan()` `:144`; **enforced** by `isOverMonthlyAllowance(monthSwift, monthForge, plan)` at `apps/api/src/services/model-router.ts:505` (goblin_hosted turns only) | VERIFIED 2026-07-05 (values match ledger) |
| Regional caps (Tier 2/3) | cap-aware: scale with regional net (e.g. T3 Build 6.5M) | dashboard regional panel | FORMULA |

**Allowance accounting path (VERIFIED 2026-07-05):** usage is read by `goblinWeightedUsage()` `apps/api/src/services/model-router.ts:275-306` — a month-scoped read of `completion_costs` filtered `user_id` + `source_tier='goblin_hosted'`, summing `tokens_in + tokens_out`, split Swift vs Forge by `model === 'goblin/premium'` (Forge). Rows are written by `trackCompletion()` `model-router.ts:566`. Monthly gate = `isOverMonthlyAllowance` `:505`; per-day anti-abuse gate = `isOverDailyGuard` `:513`. Only `route.layer === 'goblin_hosted'` is gated/counted (BYOK + free-API tiers are not user-allowance-billed).

---

## Mechanism register

### M1 — Chat turn, base (pre-FEEL-2 shape)
- **Trigger:** every user message in chat (project or standalone).
- **Tokens:** input = system prompt (~1.9k tokens pre-injection, measured as 7,456 chars) + history (last **50** rows) + user message; output = response (highly variable; code-generating turns 1–3k+).
- **Billed to:** user allowance (units, Forge-weighted).
- **Knobs:** history window (50) — **VERIFIED** `apps/api/src/routes/chat.ts:132` (`.limit(50)`, then `.slice(0, -1)` :134); same in the project route `apps/api/src/routes/chat-sessions.ts:174`. System prompt length: `apps/api/src/prompts/goblin-chat-system.ts`.
- **Cost:** at realistic mix $0.20/M → a 6k-token turn ≈ $0.0012.
- **CFO dependency:** A6 (limit exhaustion), Effizienzklasse (A8). | Status: FORMULA + partial MEASURED.

### M2 — Project file-content injection (FEEL-2 U1)
- **Trigger:** every turn in a **project-bound** chat.
- **Tokens:** +Δ input = injected file contents. **MEASURED 2026-07-04** (habit project): system prompt 18,733 chars (~4.7k tok) vs 7,456 (~1.9k) → **+~2.8k tok/turn typical small project; worst ≈ +12k tok** at full budget.
- **Billed to:** user allowance (flows through the same completion). **Consequence: raises effective A6 exhaustion** — e.g. 100 project-chat turns/mo ≈ +0.28–1.2M units. Most visible on Trial (4.9M): worst-case injection alone can consume ~25% of Trial via ~100 turns.
- **Knobs:** total context budget **48k chars** — **VERIFIED** `FILE_CONTENT_BUDGET_CHARS = 48_000` `apps/api/src/services/project-context.ts:14`; per-file over-budget marker "(Inhalt nicht geladen — zu gross)"; loader `loadProjectContextFiles()` `apps/api/src/services/project-context.ts`.
- **Exclusion rule (B6, feel-sprint-2):** soft-deleted files (`.trash/`, the sole soft-delete prefix) are dropped from BOTH the injected contents and the file list shown to the model — `isSoftDeletedPath()` filters `listFilesWithMeta` in `loadProjectContextFiles()` and on both chat-route degraded fallbacks (`chat.ts`, `chat-sessions.ts`). Mirror on the web STC existing-files map (`apps/web/lib/project-files.ts` `fetchAllTextFiles`) so trashed files are not GEÄNDERT/IDENTISCH candidates. Deleted content therefore never re-enters context or burns injection budget.
- **Degradation:** on provider token-limit rejection (Layer-2 free keys, e.g. Groq 12k TPM), one retry **without** file contents + honest note (FEEL-2b B2, `apps/api/src/services/token-limit-retry.ts`). **Live-verified 2026-07-05** (G3): 28'645-token request → Groq 413 → one reduced-context retry → success, no fabrication. **Measurement (I0, MOBILE-1):** each such retry now also inserts a `platform_events` row (`event_type='context_retry'`, silent-fail/no-op pre-migration 0078) → B2 retry frequency is queryable from the DB, not only Railway logs.
- **CFO dependency:** A19 (new register row), A6, Trial economics (kTrial), regional typical margin. | Status: MEASURED (1 project) — widen with prod telemetry.
- **Measurement path (I0, MOBILE-1) — no token change, attribution only:** `completion_costs` rows are now attributable project-vs-standalone. The chat-sessions route passes `chatSessionId` (→ `chat_sessions.project_id`); additionally `trackCompletion` writes `completion_costs.project_id` directly (migration 0077, `add column if not exists project_id`; API write is pre-migration tolerant — retries the insert without `project_id` rather than dropping the cost row) so the **legacy** project route (`chat.ts`, no session row — telemetry NOTES gap #1) is also attributable. `project_id` NULL = standalone. A19 (project vs standalone split) becomes computable. Cost formulas unchanged.

### M3 — Project-state summarizer (FEEL-2 U3)
- **Trigger:** async after each completed assistant turn in a project chat (`scheduleProjectStateUpdate` → `updateProjectState`, `apps/api/src/services/project-state.ts:124/73`).
- **Tokens:** input ≈ prior state + latest exchange (~1.5–2k) · output ≤ **300** (hard cap `MAX_RAW_OUTPUT_CHARS = 4000` `project-state.ts:26`, ~300 output tokens) · model **pinned `goblin/efficient`** (FEEL-2b B1, `project-state.ts:23`).
- **Billed to — PLATFORM COGS (FIXED, CC 2026-07-05, FEEL-2 merge prep B5).** The summarizer is exempt from user allowance. `updateProjectState()` calls `streamCompletionGuarded({ …, internalBilling: true })` `project-state.ts:86-96`. In `streamCompletion` (`model-router.ts`) that flag (a) skips the goblin_hosted allowance/daily gate — `if (route.layer === 'goblin_hosted' && !internalBilling)` `model-router.ts:~514` — so a user at their cap still gets background summarization and it never reads as user spend; and (b) suppresses the `completion_costs` write (the row `goblinWeightedUsage` sums into monthly usage): both `trackCompletion` sites are now `if (internalBilling) logger.info({ billing: 'platform_cogs', tokensIn, tokensOut, … }) else await trackCompletion(...)`. **Accounting mechanism = structured server log line** (`feature: project-state-summarizer`, `billing: platform_cogs`, per-call input/output tokens) — measurable COGS, zero user-allowance impact. **Not user-reachable:** `internalBilling` is a typed param set as a code literal ONLY in `project-state.ts`; no HTTP route (chat.ts/chat-sessions.ts/code-sessions.ts/models.ts) reads or forwards it — the summarizer is invoked server-side via `scheduleProjectStateUpdate` with explicit fields, never from request body. **Status: FIXED 2026-07-05 (was VERIFIED-FAIL).**
- **Cost:** ~2k tok × $0.162/M ≈ **$0.0003/turn** → $0.02–0.10 per active user/mo. Pure platform COGS; no user-allowance consumption.
- **Knobs:** output cap (`project-state.ts:26`), summarizer prompt (`apps/api/src/prompts/project-state-summarizer.ts`), model pin (`project-state.ts:23`), billing exemption (`internalBilling`, `project-state.ts` + `model-router.ts`).
- **Measurement (I0, MOBILE-1):** the `billing: platform_cogs` log line now has a DB twin — both `internalBilling` sites in `model-router.ts` also insert a `platform_events` row (`event_type='platform_cogs'`, model + tokens_in/out + meta; silent-fail/no-op pre-migration 0078). A20 platform COGS is therefore measurable from the DB without Railway log access (defuses half of ticket #12). No token change — logging/attribution only.
- **CFO dependency:** A20 (new register row); per-user variable **platform COGS** (+<1%), NOT user allowance. | Status: FIXED (accounting) — prod COGS now measurable from `platform_events` (0078) + the platform_cogs log line.

### M4 — Build (Send-to-Code → build pipeline)
- **Trigger:** user-initiated build.
- **Tokens/units:** flat **150k units** per build (COST_UNITS_PER_BUILD, reconciled) — `goblin-cap.ts:84`.
- **Billed to:** user allowance. → Build plan ≈ 116 pure-Swift builds/mo (17.4M ÷ 0.15M) — the dashboard "kBuilds" figure.
- **CFO dependency:** kBuilds KPI, A6. | Status: FORMULA — constant VERIFIED `goblin-cap.ts:84`. **VERIFY-PATH RESOLVED (CC 2026-07-05):** there is **no flat per-build allowance deduction** — `COST_UNITS_PER_BUILD` is referenced only at (1) `goblin-cap.ts:99` (`TRIAL_DAILY_GUARD = TRIAL_BUILDS_PER_DAY × COST_UNITS_PER_BUILD`, the trial anti-abuse threshold) and (2) `apps/web/lib/plan-builds.ts:19,31-34` (web display: builds-per-plan = allowance ÷ 150k). A build's real spend flows through the same token accounting as chat (M1/M2 → `completion_costs` via `trackCompletion`); the 150k is a **reconciliation/display constant**, not an applied charge. So "kBuilds" is a derived KPI, not a metered counter.

### M5 — Zero-token mechanisms (registered for completeness)
Deploy truth-gating (P0.2: HTTP checks only) · STC integrity checks (client/shared lib) · activity indicator, file-cards, diffs (client-side) · idempotency keys (0075) — **no model tokens.** Any future change that adds model calls to these paths must add a ledger row first.

### M8 — Dictation transcription (CHAT-IO C1)
- **Trigger:** user records a voice memo in the chat composer **on a browser without a usable Web Speech API** (chiefly iOS Safari; also desktop Safari). Desktop/Android Chrome use the on-device Web Speech API and hit **no** server model — zero platform tokens. Only the MediaRecorder → `/api/transcribe` fallback path incurs a model call.
- **Tokens:** one Whisper-class transcription per recording (audio in → text out). Not chat tokens — a separate DeepInfra `audio/transcriptions` call. Model `openai/whisper-large-v3-turbo` (env `GOBLIN_TRANSCRIBE_MODEL`).
- **Billed to — PLATFORM COGS v1 (founder decision, C1).** Exempt from user allowance; never written to `completion_costs`. Accounting = structured log line `feature: dictation-transcribe`, `billing: platform_cogs` in `apps/api/src/routes/transcribe.ts` (mirrors the M3 summarizer pattern).
- **Knobs (all in `apps/api/src/routes/transcribe.ts`):** per-user **daily cap 30** (`TRANSCRIBE_DAILY_CAP`, abuse guard — v1 in-memory per instance; resets on deploy, not shared across replicas — promote to a persisted counter if volume grows); size cap `MAX_AUDIO_BYTES = 15 MB` + client-reported `MAX_AUDIO_DURATION_MS = 125_000` (~2 min); model slug (`GOBLIN_TRANSCRIBE_MODEL`). Client hard-stops recording at 120s (`use-dictation.ts` `MAX_RECORD_MS`).
- **Cost:** DeepInfra Whisper ≈ **$0.0005/min** of audio → a 2-min memo ≈ $0.001; at the 30/day cap ≈ $0.03/user/day worst case. Pure platform COGS; no user-allowance consumption. Local/no-key returns a deterministic mock (no cost).
- **CFO dependency:** small variable **platform COGS** (like M3), NOT user allowance; add an A-row when prod volume is measured. | Status: FORMULA (pricing 2026-07) — prod COGS measurement open (read from the `platform_cogs` log line).

### M9 — Chat attachments (CHAT-IO C2)
- **Trigger:** user attaches a file in chat (text-class file, or PDF; images accepted but not sent as pixels). On send, the extracted/read text is injected into the **user's turn** as a delimited `Angehängte Datei: <name>` fenced block.
- **Tokens:** +Δ input = attachment character content (≈ chars/4 tokens), added to that one completion's input. Output unchanged. PDF text extraction itself is **zero model tokens** (a lib call in `/api/attachments/extract`, no LLM). Images add only a short honest note (~30 tokens), never image tokens.
- **Billed to:** **user allowance** — attachments are user input in the user's turn, flow through the same completion as M1/M2 (no special path). A19-adjacent: like M2 it raises effective A6 exhaustion, but bounded per message by the attach budget.
- **Knobs:** attach budget **24_000 chars/message** across all text+PDF attachments — `ATTACH_BUDGET_CHARS` in `apps/web/lib/chat-attachments.ts` (over-budget → honest pre-send UI error, **never silent truncation**); PDF upload cap `MAX_PDF_BYTES = 10 MB` in `apps/api/src/routes/attachments.ts`.
- **Degradation:** attachments live in the user message, so the M2 reduced-context retry (which drops only the injected **project** file section) never silently drops them; if the provider token-limit still trips, the user gets the honest token-limit error (suggest shortening/splitting) — no fabrication.
- **CFO dependency:** A6, A19 (same register family as M2) — widen with prod telemetry. | Status: FORMULA — measure with prod telemetry.

### M7 — Line-anchored instruction (MOBILE-1 Tier 2, "Diese Stelle ändern lassen")
- **Trigger:** user long-presses a line (or a range) in the Reader / Diff sheet, chooses "Diese Stelle
  ändern lassen", pre-anchors the command bar, and sends. One anchored send = one normal chat completion.
- **Tokens:** +Δ input over a bare M1 turn = the anchor payload — a preamble (`[Anker → file · Zeile a–b] …`)
  plus **±`SURROUNDING_LINES` (=10)** lines of surrounding code with line numbers. Typical add ≈ **a few
  hundred input tokens** (≈20 context lines × ~8 tok + preamble ≈50 tok ≈ 200 tok). The message also still
  flows through U1 file-content injection (M2), so the anchor is *additive* to that. Output = the targeted
  edit (variable, like M1). **Built deterministically** by `buildAnchoredMessage()` — verifiable without a
  model round-trip.
- **Billed to:** **user allowance** — the anchored instruction is a normal user turn (no special path); it
  flows through the same completion as M1/M2. Result lands as a reviewed `GEÄNDERT` draft (no auto-apply).
- **Knobs:** `SURROUNDING_LINES` (= **10**) — `apps/web/lib/anchor-message.ts` (the sole token knob; raising
  it linearly increases the added input tokens for better targeting); the anchored range/location (user-chosen).
- **Cost:** at realistic mix $0.20/M → +~200 input tok ≈ **+$0.00004/anchored send** on top of the base turn.
  Negligible per use; scales with anchored-send frequency.
- **CFO dependency:** A6 (exhaustion), A19 family (project token split — same as M2). | Status: FORMULA
  (constants VERIFIED `anchor-message.ts`) — widen with prod telemetry once anchored sends are measurable
  (attributable via I0 `completion_costs.project_id` + `chat_session_id`).

### M6 — Reserved (not yet built; add rows before shipping)
Web search / Recherche (feature-flagged off) · extended thinking · FEEL-3 agent loop (tool-calling turns — will dominate this ledger when built; **cost model required before merge**).

---

## Measurement & reconciliation protocol

1. **Instrumentation exists:** `agent_runs.input_tokens/output_tokens` + chat `done`-event token fields. FEEL-2 makes these meaningful per-turn.
2. **After each consumption-relevant merge:** ~1 week prod telemetry → compute real tokens/turn (project vs standalone), real monthly units/user distribution.
3. **Reconcile:** update A6 (exhaustion) and A19/A20 actuals in the dashboard register; if typical usage shifts materially (>±30% vs the 5M-unit "typical" anchor), recompute the Speck/Regional "typical margin" columns and note the Rev in the dashboard stamp.
4. **Never** change plan prices/caps from formula drift alone — floors are price-derived and stay valid; only the *typical* columns move with usage.

## Repo integration
Committed as `docs/GOBLIN_CONSUMPTION_LEDGER.md`. First CC touch (2026-07-05): VERIFY-PATH cells resolved — FORGE_WEIGHT (`goblin-cap.ts:48`), COST_UNITS_PER_BUILD (`:84`), plan allowances (`GOBLIN_MONTHLY_ALLOWANCE :55` + enforcement `model-router.ts:505`), history window (`chat.ts:132`), allowance accounting (`goblinWeightedUsage model-router.ts:275` + `trackCompletion :566`). **M3 accounting = FIXED (2026-07-05, FEEL-2 B5): the summarizer is now platform COGS via `internalBilling` — exempt from the user allowance gate and excluded from `completion_costs` (see M3).** **M4 VERIFY-PATH = RESOLVED (2026-07-05): no flat per-build charge site exists — `COST_UNITS_PER_BUILD` is used only for the trial daily guard (`goblin-cap.ts:99`) and web display (`plan-builds.ts`); builds bill via actual completion tokens (see M4).**
