# GOBLIN CONSUMPTION LEDGER
**The consumption blueprint (Verbrauchs-Bauplan). v1.0 · 2026-07-04 · Author: Steven · Repo target: `docs/GOBLIN_CONSUMPTION_LEDGER.md`**
**VERIFY-PATH cells + M3 accounting resolved by CC 2026-07-05 (FEEL-2b reverify). Resolutions cite code at that commit — re-confirm line numbers if the files move.**
**I0 (MOBILE-1, 2026-07-07): measurement-only changes — `completion_costs` now attributable project-vs-standalone (`chat_session_id` + `project_id`, migration 0077); `platform_events` table (0078) gives A20/B2 a DB twin of the platform_cogs/context_retry log lines. No token consumption changed. Migrations 0077/0078 authored, NOT applied — founder applies. See M2/M3.**
**P1.8 (speed measurement, 2026-07): MEASUREMENT-ONLY — added `completion_costs.ttft_ms` + `completion_costs.duration_ms` (time to first token + total generation wall time, ms; tokens/sec derivable from `tokens_out ÷ duration_ms`) via migration 0080, pre-migration-tolerant like 0077 (`trackCompletion` retries the insert without the timing columns / project_id if absent, never dropping a cost row). Populated on the primary Goblin-hosted streamed completion (`model-router.ts` direct-SDK path). NO change to token consumption, cost, or billing math — we measure Swift latency before tuning it. Migration 0080 authored, NOT applied — founder applies via Supabase SQL Editor.**
**WAVE-I (behaviour measurement, 2026-07-10): ZERO TOKEN CONSUMPTION — NOTE only, no M-row. Extends `platform_events` (migration 0085: drops the closed `event_type` CHECK from 0078, adds funnel/journeys indexes; authored, NOT applied) from internal-accounting into the canonical BEHAVIOUR funnel (signup→onboarding→project→message→agent-run→publish→upgrade). All emission is metadata-only and fire-and-forget (`trackEvent`, silent-fail); NO model call, NO `completion_costs` row, NO change to token math or billing. New surfaces (`/admin/insight`, `POST /api/events`, optional founder digest) read `platform_events` + `users` only. Events are personal data → joined to the account-deletion purge (I3, `account-deletion.ts`). Nothing here consumes Swift/Forge tokens, so no mechanism register row is warranted — this NOTE records the wave per the standing rule.**

**WAVE-A (speed & Schönheit, 2026-07-11): NET input-token change is small and mostly CACHE-WARM; no new billing path, all on the existing agent completion (user allowance, M1/M10 family). (A-1) The agent system prompt is restructured around a byte-stable static prefix so DeepInfra's automatic prefix caching applies (`prompt_cache_key` per tier, `model-turn.ts`) — cached input tokens are billed at a REDUCED rate, so effective input cost per agent turn DROPS after warm-up; token COUNT unchanged, cost-per-token lower. (A-2) A compact design-foundation block (`prompts/app-design-foundation.ts`, ~800 input tokens, measured) rides in that static prefix → +~800 input tok on the FIRST agent turn per warm prefix, then cache-warm (~0 marginal) on subsequent turns. A19-adjacent (shapes generated apps, same project completion). (A-4) Plan mode adds a short few-shot to the static prefix (~+250 input tok, cache-warm) and, on COMPLEX runs only, one extra narrated plan line in output (~tens of output tok); trivial runs unchanged. (A-5 push, A-6 stop-report) are ZERO model tokens — web-push send, a report-fetch REST endpoint, and settings wiring, no model call. No migration applied by us; A-6 authored migration 0088 (agent_runs.report jsonb) NOT applied.**

**WAVE D-G (generation beauty, 2026-07-15): NO NEW BILLING PATH — a prompt-token increase inside the EXISTING agent + chat completions (user allowance, M1/M10 family). NOTE, not an M-row; SUPERSEDES the WAVE-A A-2 "~800 tok, agent-only" figure. (U2) The design-foundation block (`prompts/app-design-foundation.ts`) was upgraded from a compact system-font floor into the opinionated beauty contract (font PAIRING via Google Fonts, `:root` custom-property palette, one coherent mood, careful details, a BAD/GOOD few-shot) AND extended to the SECOND generation path: it now rides the byte-stable static prefix of BOTH the agent prompt (`AGENT_STATIC_PREFIX`) and the base-chat prompt (`buildGoblinChatSystemPrompt`) — WAVE-A had kept it agent-only. EXACT cost, measured with the real DeepInfra tokenizer (DeepSeek V3.2 = Goblin Swift, `scripts/dg-beauty/measure-block.ts`): **+1549 input tokens** per generation turn (block chars 4782). Because it sits in the byte-stable prefix on both paths, DeepInfra's automatic prefix cache makes it **cache-warm (~0 marginal) after the first call per warm prefix** — the +1549 is a first-cold-call cost, not a per-turn cost. **No output-token change** (it shapes generation QUALITY, not length — if anything it slightly lengthens the CSS the model writes, folded into the existing agent/chat output already billed). Honest cost note: base chat now carries the block on EVERY chat message, including a non-code chat ("wie zentriere ich ein div") — so a cold first chat turn per warm window pays +1549 input tok it did not before; bounded, cache-warm thereafter, no new mechanism/knob/migration, same user-allowance completion. One-off verification (`scripts/dg-beauty/*`: 3 before + 3 after generations + 6 register probes + 2 tokenizer probes on Swift) ≈ **$0.02 total wholesale**, a one-time gate cost, not a runtime path. (U3) The chat register touch-up (one added `Sprachregister` bullet in `IDENTITY`) adds ~90 input tokens to the base-chat/agent static prefix (cache-warm), and its INTENT is to trim habitual sales-closer OUTPUT — net output-token effect ≤0. No migration for the wave.**

**WAVE-J (support & feedback, 2026-07-10): ONE new token-consuming mechanism → M12 (support agent). The "Goblin Hilfe" support agent is PLATFORM COGS (pinned `goblin/efficient`, `internalBilling: true`, hard-gated to the goblin-hosted tier so it never spends a user's BYOK key), per-user-daily-capped, per-message output-budgeted. Help content (J1), feedback (J3), escalation email/ticket, and JIT wiring (J4) are ZERO model tokens — the help corpus is static data, feedback is a DB write + email, escalation is a non-model render. New event types (`support_chat_started/escalated`, `agent_run_started` rider) are metadata-only `platform_events` (no model call), like WAVE-I. Migrations 0086 (support_tickets) / 0087 (feedback) authored, NOT applied.**

**FW5 (polish, 2026-07-15): NO NEW MODEL-TOKEN PATH. NOTE, not an M-row. (U3 · D-D explorer upload) The workspace Explorer's file upload was routed through the EXISTING hardened chain — no new storage mechanic: the FW2-U3-style type whitelist (`apps/api/src/services/upload-policy.ts`), the D-2 daily-bytes cap, the `storageKey` prefix-jail, and the per-plan storage cap. It reuses the SAME `consumeDailyBytes('attachment', …)` accumulator + `ATTACHMENT_BYTES_PER_DAY` (100 MB/day/user) as chat-attachment extraction — so that cap now means "upload bytes/day across chat attachments AND explorer uploads" (a shared per-user ceiling, still COGS-bounding, no new charge). Uploaded files are billed only as storage (plan cap, unchanged) and, if later injected into a chat/agent turn, as input like any project file (M2, unchanged) — no upload-time model call. Zero migration for U3. (U6 Forge-heartbeat + F-25 knapp riders: zero / negative token effect, noted in the F4.2 block below.) **(U5 · D-F auto-refund) FAIRNESS-COST NOTE — new non-token COGS line for the CFO dashboard: on subscription cancellation `handleSubscriptionDeleted` now auto-refunds any remaining downgrade credit to the card (`refundRemainingCreditOnCancel`, `services/billing-service.ts`). VERIFIED 2026-07-15: Stripe does NOT return the original processing fee on a refund (any method, EU included) — so each such refund costs Goblin ≈ 1.4% + €0.25 of the refunded amount, unrecovered. This is an ACCEPTED brand/fairness cost (founder decision c), not passed to the user. Magnitude is bounded: it only fires for the downgrade-then-cancel edge case, on the leftover credit only, and is idempotent per subscription (no double refund on webhook retry). CFO dependency: a small addition to Stripe-fee COGS, sized once prod shows how often the edge case occurs. Zero model tokens, zero migration for U5.**

**WAVE-D (Sicherheit vor Menschen, 2026-07-11): NO NEW CONSUMPTION — these are COGS-BOUNDING abuse caps (they only LOWER worst-case per-user platform cost; no new token path, no billing-side change). NOTE, not an M-row. New/changed per-user/per-window ceilings, all env-knobbed with honest German 429 + Retry-After (never a silent drop): (D-2a) agent runs — `AGENT_RUNS_PER_HOUR` default **30/h**, enforced `apps/api/src/routes/code-sessions.ts` POST `/:sessionId/agent` after eligibility via `hitRateLimit` (in-memory fixed window, per-instance like M8/M11) → bounds M10 (agent completion) COGS/user/hour. (D-2b) publishes — `PUBLISHES_PER_HOUR` default **20/h**, enforced in the agent `publish` tool `apps/api/src/services/agent/tools.ts` → bounds M4/Vercel-deploy COGS from the agent path (the "Live stellen" button path already caps via `deploy.ts`, now `BUILDS_PER_HOUR` default **10/h**). (D-2c) attachment bytes/day — `ATTACHMENT_BYTES_PER_DAY` default **100 MB/day/user**, enforced `apps/api/src/routes/attachments.ts` via `consumeDailyBytes` (`apps/api/src/services/abuse-caps.ts`) → bounds M9 upload volume beyond the per-file 10 MB ceiling. (D-2d) M8 dictation cap `TRANSCRIBE_DAILY_CAP` (default 30/day) is now env-knobbed (was hardcoded) — same value, tunable. All counters in-memory/per-instance (reset on deploy, not cross-replica) — the durable cross-replica DB counter is a founder-gated infra decision recorded in `_sprint/wave-d/SECURITY_AUDIT.md`, not assumed here. Billing side unchanged everywhere (platform COGS stays platform COGS; user allowance stays user allowance) — these caps are ceilings, not new charges. Zero migration.**

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
- **F4.2 note (feel-4 — global user preferences, negligible):** the "Wie Goblin arbeitet" block (`renderUserContext`, `goblin-chat-system.ts`) now rides EVERY chat and agent turn (project + standalone). Structured prefs (Anrede/Antwortstil/Erklärtiefe) add **~1 short line each (<40 tok total)**; `custom_instructions` (previously stored-but-never-injected, now live — 0048) adds **≤4k chars ÷ 4 ≈ ≤1k tok/turn** only when the user has set it, zero otherwise. Loader `loadUserPreferences` (`services/user-preferences.ts`); the three structured columns are dark until migration 0082 is applied (authored). **User allowance**, same completion, no new billing path. Negligible vs M2 file injection.
- **F-25 note (FW5-U6, input-side, negligible & self-funding):** the `responseStyle==='knapp'` branch of `renderUserContext` was tightened (1–3 Sätze + Verbot des Verkaufsabschlusses + ein Kurz-Few-Shot). The injected line grew from ~30 tok to **~120 tok — only when the user has selected "Knapp"** (zero otherwise), and it rides the already-cached static-ish prefix region for a warm user. Its whole purpose is to SHORTEN the model's OUTPUT (the expensive side at $0.294/M out vs $0.147/M in for Swift), so the net token effect for a knapp user is negative. No new billing path, user allowance, same completion. Real-model probe 3/3 short (`evidence/fw5-u6/f25-knapp-probe.txt`).
- **CFO dependency:** A6 (limit exhaustion), Effizienzklasse (A8). | Status: FORMULA + partial MEASURED.

### M2 — Project file-content injection (FEEL-2 U1)
- **Trigger:** every turn in a **project-bound** chat.
- **Tokens:** +Δ input = injected file contents. **MEASURED 2026-07-04** (habit project): system prompt 18,733 chars (~4.7k tok) vs 7,456 (~1.9k) → **+~2.8k tok/turn typical small project; worst ≈ +12k tok** at full budget.
- **Billed to:** user allowance (flows through the same completion). **Consequence: raises effective A6 exhaustion** — e.g. 100 project-chat turns/mo ≈ +0.28–1.2M units. Most visible on Trial (4.9M): worst-case injection alone can consume ~25% of Trial via ~100 turns.
- **Knobs:** total context budget **48k chars** — **VERIFIED** `FILE_CONTENT_BUDGET_CHARS = 48_000` `apps/api/src/services/project-context.ts:14`; per-file over-budget marker "(Inhalt nicht geladen — zu gross)"; loader `loadProjectContextFiles()` `apps/api/src/services/project-context.ts`.
- **Exclusion rule (B6, feel-sprint-2):** soft-deleted files (`.trash/`, the sole soft-delete prefix) are dropped from BOTH the injected contents and the file list shown to the model — `isSoftDeletedPath()` filters `listFilesWithMeta` in `loadProjectContextFiles()` and on both chat-route degraded fallbacks (`chat.ts`, `chat-sessions.ts`). Mirror on the web STC existing-files map (`apps/web/lib/project-files.ts` `fetchAllTextFiles`) so trashed files are not GEÄNDERT/IDENTISCH candidates. Deleted content therefore never re-enters context or burns injection budget.
- **Degradation:** on provider token-limit rejection (Layer-2 free keys, e.g. Groq 12k TPM), one retry **without** file contents + honest note (FEEL-2b B2, `apps/api/src/services/token-limit-retry.ts`). **Live-verified 2026-07-05** (G3): 28'645-token request → Groq 413 → one reduced-context retry → success, no fabrication. **Measurement (I0, MOBILE-1):** each such retry now also inserts a `platform_events` row (`event_type='context_retry'`, silent-fail/no-op pre-migration 0078) → B2 retry frequency is queryable from the DB, not only Railway logs.
- **A19 note (F4.1 — project instructions, feel-4):** per-project user-authored **`projects.instructions`** (≤2k chars, cap enforced `apps/api/src/routes/projects.ts` PUT `/:id/instructions`) now rides this same injection — rendered by `renderProjectContext()` above the rolling memory (`goblin-chat-system.ts`, `projectInstructions`), wired into all three prompt paths (`chat.ts`, `chat-sessions.ts`, `code-sessions.ts` agent). **+Δ input ≤ ~500 tok/turn** when set (≤2k chars ÷ 4), zero when empty — additive to M2 file injection and, in agent runs, re-sent each turn like the step history (bounded by the 8-iteration cap, M10). Same A19 family (project vs standalone split); **user allowance**, same completion, no new billing path. The memory read/reset endpoints (`GET`/`DELETE /:id/state`) are DB-only, **zero model tokens**.
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

### M10 — Agent run (FEEL-3a loop + FEEL-3b publish/self-heal)
- **Trigger:** a project chat on an agent-eligible model (Goblin Swift default / Forge opt-in, D2),
  with the `AGENT_LOOP` flag on (or the test account), runs the server-side orchestrator loop
  (`apps/api/src/services/agent/orchestrator.ts`) instead of a single completion. One run = N model
  turns, each of which may call a tool (`list_files`/`read_file`/`write_file`/`save_draft`/`publish`/
  `read_deploy_status`/`finish`) whose result is fed back as the next turn's input. **FEEL-3b adds the
  publish half:** a run may now end in a **verified live deploy** — but only on explicit publish intent
  (D1 gate) or a confirmation-chip tap; otherwise it still lands as a saved draft.
- **Tokens (per run):** Σ over turns of (injected context + accumulated **step history** + tool results
  as input) + narration/tool-call tokens as output. The step history is the A19 driver: each turn re-sends
  the prior turns' assistant messages + tool results, so input grows ~linearly with iteration count —
  **capped structurally by the iteration budget** (below). Typical Swift run (small project, 3–5 turns,
  ~5k injected context + growing tool results) ≈ **60–150k weighted units**.
- **FEEL-3b publish cost:** `publish`/`read_deploy_status` consume **no extra model tokens themselves**
  (the deploy + n/6 truth-gate run server-side; only their short structured *result* re-enters the next
  turn's input). The real driver is **self-heal**: a red gate feeds the error back and the model may run
  **at most 2 corrective cycles** (each = up to 1 rewrite turn + 1 re-publish), orchestrator-enforced —
  so a worst-case publishing run adds ~2–3 turns over a draft-only run, still inside the 8-iteration cap.
  A typical explicit-publish Swift run (build + 1 clean publish) ≈ **90–180k units**; a 2-cycle self-heal
  run ≈ **150–260k units** (may hit the 200k budget → truthful finish).
- **Billed to:** **user allowance** — user-initiated work. Every model turn flows through the existing
  `trackCompletion` with the new **`run_id`** (migration 0081) so `completion_costs` rows for a run are
  summable (the report's cost line + telemetry). No special path; same weighted accounting as M1/M2.
- **Weighting:** one run uses one model, so `runWeightedUnits` (`config.ts`) applies `FORGE_WEIGHT` (4.4×,
  `goblin-cap.ts:48`) for Forge, 1× for Swift — a Forge run costs ~4.4× a Swift run of the same tokens.
- **Budget knobs (enforced by the orchestrator, forced truthful finish on breach):**
  - `AGENT_MAX_ITERATIONS` (default **8**) — max model turns/run (`config.ts` `agentMaxIterations`).
  - `AGENT_MAX_UNITS` (default **200_000**) — max weighted units/run (`config.ts` `agentMaxUnits`).
  On breach the loop stops and emits "Budget erreicht — Stand: …" (`outcome='budget'`), never an infinite loop.
- **Cost:** at Swift blended ≈ $0.162/M units → 60–150k units ≈ **$0.012–0.03/run**; Forge ≈ 4.4× that.
  A Trial (4.9M units) affords ~30–80 Swift runs; the Build plan ~120–290. Healthy against the allowance.
- **A19 note:** step history accumulates per turn WITHIN a run; the iteration cap (8) bounds it — a run can
  never silently grow context without limit. Persisted to `agent_runs.step_log` (0081) for post-merge
  reconciliation.
- **F-40 NOTE (resumable runs — consumption reality, NO new token mechanism):** F-40 decouples a run from
  the HTTP request (`run-registry.ts`): the run now **continues server-side after the client disconnects**
  and finalizes normally. **No new per-turn cost** — the per-run token model above is unchanged (same turns,
  same tools, same weighting, same `AGENT_MAX_ITERATIONS`/`AGENT_MAX_UNITS` budgets). What changes is the
  **completion rate**: runs that previously **died with the tab** (client disconnect aborted the run via
  `stopSignal = c.req.raw.signal`) now **run to completion**, so tokens that used to be *abandoned mid-run*
  are now *fully spent*. Direction of the effect: realized units/run trend **up toward the formula ceiling**
  (fewer truncated-early runs), not a new charge. Still billed to **user allowance**, still summable via
  `completion_costs.run_id` — the reconciliation path is unchanged.
  - **The cost control is the max-runtime guard:** `AGENT_MAX_RUNTIME_MS` (default **600_000 = 10 min**,
    `config.ts` `agentMaxRuntimeMs`) — a hard wall-clock ceiling that aborts an **abandoned** run so a
    detached run can never burn tokens forever. It bounds the *new* risk F-40 introduces (a run with no
    client watching): worst case per orphaned run is still capped by whichever of `AGENT_MAX_ITERATIONS` /
    `AGENT_MAX_UNITS` / `AGENT_MAX_RUNTIME_MS` binds first. Lower it to tighten the orphan ceiling.
  - **Post-merge reconciliation:** the "runs die on disconnect" truncation was an *invisible* discount on
    realized units/run; expect measured units/run to rise modestly after F-40. Re-measure A6/A19 against
    `agent_runs` + `completion_costs.run_id` on the standing 1-week cadence and note any material shift.
- **FW4-U1 NOTE (F-11 publish/build-intent routing — VOLUME shift, NO new token mechanism):** U1 makes a
  project-chat message with clear build/publish intent (`classifyRunIntent`, `services/agent/intent.ts`)
  hand off from the **tool-less chat lane (M1/M2 — one completion)** into an **agent run (this M10)**. Per
  *routed* message the per-run token model above is unchanged (same turns/tools/weighting/budgets); what
  shifts is the **mix**: a build/publish message that used to cost ~1 chat completion now costs one full
  agent run (60–260k units, Forge 4.4×). Direction: a modest **up-shift in agent-run volume** (more
  eligible sessions started from chat), bounded per run by the same `AGENT_MAX_ITERATIONS`/`AGENT_MAX_UNITS`/
  `AGENT_MAX_RUNTIME_MS` guards and per user by `agentRunsPerHour` (`abuse-caps.ts`). **Guardrails contain the
  volume:** routing fires ONLY when (project chat) AND (Swift/Forge model selected) AND (explicit
  build/publish intent — a bare "live" mention stays chat), so a normal conversation never silently becomes a
  billed run. Still user allowance, still summable via `completion_costs.run_id`. Re-measure the chat→agent
  routed fraction against `platform_events` (`agent_run_started`) on the standing 1-week cadence.
- **FW4-U4 NOTE (F-19 targeted edits — OUTPUT-token REDUCTION on the edit path):** the new `edit_file`
  tool (`services/agent/tools.ts`) lets the model change a small part of an existing file by emitting only
  the anchored snippet (old_str + new_str) instead of re-emitting the WHOLE file via `write_file`. For a
  small edit of a large file this cuts the turn's **output** tokens from ~O(file size) to ~O(change size) —
  a real reduction in the A19 output driver (output tokens dominate cost at the goblin-hosted blended rate).
  No new billing mechanism: `edit_file` produces the full content internally and flows through the SAME
  `finalizeDraftWrite` (classify → upsert draft) as `write_file`, so weighting/accounting/`run_id` are
  unchanged — only fewer tokens are generated per small edit. Direction: realized units/edit trend **down**
  (model compliance-dependent — measured by the F-19 prod probe: emitted bytes ≪ file size, 4/5). Input side
  is unchanged (read_file still returns the full file). Reconcile with A19 on the standing cadence.
- **CFO dependency:** A6 (exhaustion — agent runs are the heaviest single user action), A19 (step-history
  growth). | Status: FORMULA — reconcile with A6/M10 actuals 1 week post-merge (the standing telemetry
  protocol), using `agent_runs` + `completion_costs.run_id`. **F-40 adds `AGENT_MAX_RUNTIME_MS` as the
  orphan-run cost control (default 10 min); no new token mechanism.**

### M11 — Web search (FEEL-4 F4.3 agent tool · FW2 F-43 chat toggle)
- **Trigger (two surfaces, SAME budget/cap/provider):**
  1. **Agent run** — the agent calls `web_search(query)` during a run (per-run cap 3), unchanged.
  2. **FW2 F-43 — chat "Websuche" toggle** — when the toggle is ON, a project/base-chat send is routed
     through `runChatWebSearch` (`services/search/augment.ts`), which runs **exactly ONE** live search
     before the completion and injects the hits as system context (search-augmented generation). This is
     the surface that lifts the old "base chat cannot search" limitation. Reuses `resolveSearchProvider` +
     the SAME per-user daily cap — it does NOT add a new provider, key, or budget, only a new trigger.
  Both surfaces advertise/search only when a provider is configured; off / no provider → zero cost, no phantom.
- **Two cost components:**
  1. **Search API fee** — one Brave Web Search request per call.
     - **PLATFORM key** (`BRAVE_SEARCH_API_KEY`, bundled default) = **PLATFORM COGS**, protected by a
       **per-user daily cap 25** (`SEARCH_DAILY_CAP`, in-memory per instance like the M8 dictation cap) and a
       **per-run cap 3** (`AGENT_MAX_SEARCHES`, enforced in the run's executor closure). Brave pricing:
       free tier ~2k queries/mo, then ~**$3/1k** → a capped user costs ≤ 25 × $0.003 = **$0.075/day** worst case.
     - **USER key** (BYOK 'brave', `resolveSearchProvider` prefers it) = **zero platform cost**, **cap-EXEMPT**
       (the user's own free Brave quota, ~2k/mo). JIT-offered when the platform daily cap is hit.
  2. **Result tokens** — the returned hits (title/url/snippet, ≤5 results) re-enter the next agent turn's input,
     so they are **user-billed input** exactly like any tool result (flows through the M10 agent accounting,
     `run_id`). Rough add ≈ **≤300–500 input tok per search** (5 results × ~60–90 tok). Always user allowance,
     regardless of whose API key served the search.
- **Billed to:** search fee = PLATFORM COGS (platform key, capped) OR zero (user key); result tokens = **user allowance** (always).
- **Knobs:** `AGENT_MAX_SEARCHES` (per-run, default 3) + `SEARCH_DAILY_CAP` (per-user/day, default 25) —
  `apps/api/src/services/search/index.ts`; provider key `BRAVE_SEARCH_API_KEY`; result count (5) in both
  `services/agent/tools.ts` `toolWebSearch` and `services/search/augment.ts` `runChatWebSearch` (chat toggle,
  1 search/send — no per-run loop). The daily cap (25) is shared across BOTH surfaces per user.
- **Accounting mechanism:** platform-key searches decrement the in-memory daily counter (abuse guard, not a
  billing ledger — resets on deploy, per-replica). Promote to a persisted counter / `platform_events` row if
  search volume grows and per-search COGS needs DB-level measurement.
- **CFO dependency:** small variable **platform COGS** (like M3/M8), NOT user allowance for the fee; A19 family
  for the result-token add. | Status: FORMULA (Brave pricing 2026-07) — measure prod search volume post-merge.

### M12 — Support agent ("Goblin Hilfe", WAVE-J J2)
- **Trigger:** a user sends a message in the "Goblin Hilfe" support chat (`POST /api/support/chat` → `streamSupportAgent`, `apps/api/src/services/support-agent.ts`). One message = at most one model completion. Guard paths (PII share, prompt-injection, explicit "human" request → immediate escalation) short-circuit BEFORE any model call — those turns cost **zero** model tokens.
- **Tokens:** input = support persona prompt + read-only user context (plan/counts/last-error string, no chat/file bodies) + the **full help corpus** (`renderHelpForAgent`, ~15k chars ≈ 4k tok, single-source `@goblin/shared/help-content.ts`) + short history (≤30 turns, schema-capped) + the user message (≤2000 chars). output = the reply, **hard-capped at `SUPPORT_MAX_TOKENS` (default 600)** via the new per-call `maxTokens` on the goblin-hosted path (a caller may only tighten, never raise, the platform cap). Typical turn ≈ **5–6k input + ≤600 output**.
- **Billed to — PLATFORM COGS (FIXED, founder decision, WAVE-J).** Pinned to **`goblin/efficient`** (Swift) and run with **`internalBilling: true`** (same mechanism as M3): the goblin_hosted allowance/daily gate is skipped and the `completion_costs` write is suppressed → **never** touches the user's allowance/usage. The route is **pre-resolved and hard-gated to `route.layer === 'goblin_hosted'`** — if goblin-hosted is unavailable the agent degrades honestly and does **NOT** fall back to the user's BYOK key (so support can never spend user tokens). Accounting = the `internalBilling` `platform_cogs` log line + `platform_events` row (model + tokens), exactly like M3/M8.
- **Caps / knobs (all `apps/api/src/services/support-agent.ts`):** per-user **daily message cap `SUPPORT_DAILY_CAP` (default 30)** — in-memory per instance (abuse guard, resets on deploy / per-replica, mirrors M8 dictation + M11 search; promote to a persisted counter if volume grows); per-message **output budget `SUPPORT_MAX_TOKENS` (default 600)**; model pin `SUPPORT_MODEL = 'goblin/efficient'`. Escalation → `support_tickets` row (migration 0086) + founder email (Resend, reuses `support-email.ts`) — the email/ticket transcript is the one content-bearing surface, PII-stripped, and joins the account-deletion purge (I3).
- **Cost:** ~6k tok × $0.162/M ≈ **$0.001/message**; at the 30/day cap ≈ **$0.03/user/day** worst case. Pure platform COGS; no user-allowance consumption. Escalations add zero model tokens (the email render + ticket insert are non-model).
- **CFO dependency:** small variable **platform COGS** (like M3/M8/M11), NOT user allowance; add an A-row when prod support volume is measured (read from the `platform_cogs` log line / `platform_events`). | Status: FORMULA (constants VERIFIED in `support-agent.ts`) — measure prod support volume post-merge.

### M13 — Wave-K safety layers (K2 prompt · K3 scan · K4 signals)
- **Trigger:** every agent/chat completion (K2) + every publish attempt (K3) + every verified/blocked publish (K4).
- **K2 (generation-time refusal, `POLICY_BLOCK` in `apps/api/src/prompts/goblin-chat-system.ts`):** a fixed
  ~1.1k-char German block (ABSOLUTE rule + 3 few-shots) is appended to the agent static prefix and to normal
  chat. Adds **~350 input tokens per completion** — and it rides in the **byte-stable static prefix**, so on
  the DeepInfra prefix cache it is a **cache-warm prefix, effectively negligible** after the first call (M10
  caching applies). **No output-token change.** Billing side: folds into the existing M10 (agent) / chat COGS;
  no new mechanism, no new knob. **Negligible note — no A-row.**
- **K3 (publish-time scan, `services/safety/publish-scan.ts`):** **zero model tokens.** Deterministic regex over
  the project's HTML/JS, no external service, no LLM call. Cost is a bounded local file read (≤4 MB, capped) on
  the publish path — negligible CPU, **no COGS, no allowance consumption.**
- **K4 (behavioral signals, `services/safety/signals.ts`):** **zero model tokens.** A sha256 hash + a few
  Supabase count queries on the publish path; emits `abuse_signal` / `publish_blocked` rows into the existing
  `platform_events` table (same store as I1/I2 — no new billing surface).
- **K2 real-model gate (one-off):** the `scripts/wave-k-refusal-gate.mts` eval ran **8 short completions** against
  DeepSeek V3.2 (~$0.001 total) — a one-time verification cost, not a runtime path.
- **CFO dependency:** none material. K2 adds a small fixed prompt-token increment already inside M10/chat COGS;
  K3/K4 add none. | Status: FORMULA (constants VERIFIED in the K-modules) — no separate A-row warranted.

### M6 — Reserved (not yet built; add rows before shipping)
Extended thinking · new third-party connectors beyond GitHub/Vercel/Brave. *FEEL-3a agent loop → **M10**;
FEEL-3b publish/self-heal folded into M10; web search → **M11** above.*

---

## Measurement & reconciliation protocol

1. **Instrumentation exists:** `agent_runs.input_tokens/output_tokens` + chat `done`-event token fields. FEEL-2 makes these meaningful per-turn.
2. **After each consumption-relevant merge:** ~1 week prod telemetry → compute real tokens/turn (project vs standalone), real monthly units/user distribution.
3. **Reconcile:** update A6 (exhaustion) and A19/A20 actuals in the dashboard register; if typical usage shifts materially (>±30% vs the 5M-unit "typical" anchor), recompute the Speck/Regional "typical margin" columns and note the Rev in the dashboard stamp.
4. **Never** change plan prices/caps from formula drift alone — floors are price-derived and stay valid; only the *typical* columns move with usage.

## Repo integration
Committed as `docs/GOBLIN_CONSUMPTION_LEDGER.md`. First CC touch (2026-07-05): VERIFY-PATH cells resolved — FORGE_WEIGHT (`goblin-cap.ts:48`), COST_UNITS_PER_BUILD (`:84`), plan allowances (`GOBLIN_MONTHLY_ALLOWANCE :55` + enforcement `model-router.ts:505`), history window (`chat.ts:132`), allowance accounting (`goblinWeightedUsage model-router.ts:275` + `trackCompletion :566`). **M3 accounting = FIXED (2026-07-05, FEEL-2 B5): the summarizer is now platform COGS via `internalBilling` — exempt from the user allowance gate and excluded from `completion_costs` (see M3).** **M4 VERIFY-PATH = RESOLVED (2026-07-05): no flat per-build charge site exists — `COST_UNITS_PER_BUILD` is used only for the trial daily guard (`goblin-cap.ts:99`) and web display (`plan-builds.ts`); builds bill via actual completion tokens (see M4).**
