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

**WAVE-H (Performance & Skalierung — concurrency admission, 2026-07-18): NO NEW CONSUMPTION — a COGS-BOUNDING concurrency ceiling (it only LOWERS worst-case simultaneous platform token burn; no new token path, no billing-side change). NOTE, not an M-row. (H4) A global + per-user concurrent-run cap sheds runs beyond the ceiling with an honest German 429 (`agent_at_capacity` + Retry-After; client shows "auf Anschlag" copy and auto-retries — never a silent drop, never a 500). Knobs, all `services/agent/config.ts`, enforced atomically in `startRun` (`services/agent/run-registry.ts`) with an early pre-check in `code-sessions.ts` POST `/:sessionId/agent`: `AGENT_GLOBAL_MAX_CONCURRENT` default **50** (0 = disable), `AGENT_MAX_CONCURRENT_PER_USER` default **2** (0 = disable), `AGENT_CAPACITY_RETRY_AFTER_SEC` default **8**. This bounds the MAX number of M10 (agent) completions in flight at once on the single box → caps peak simultaneous COGS and protects against the N-6 provider-throttle→shared-breaker→node-outage cascade. It is a ceiling on CONCURRENCY, orthogonal to and complementing the WAVE-D per-hour `AGENT_RUNS_PER_HOUR` (rate) cap; it adds no per-token cost and charges nothing new. In-process/per-instance like the WAVE-D caps (a cross-replica admission store remains a founder-gated infra decision — N-1/N-2, NOT assumed here). Measured before/after: peak in-flight went from tracking N unbounded (200→2000, `_sprint/wave-h/BASELINE.md`) to a hard `min(N, cap)` (`_sprint/wave-h/evidence/after-*.json`). Zero migration.**

**LAUNCH-ASSIST (Promo-Codes, 2026-07-19): ONE new PLATFORM-COGS exposure line → M16 (promo-code trial grants). A redeemed code comps an account to the top tier (`power`) for 30 days with NO Stripe object — so the ordinary M1/M10 chat/agent tokens the promo user then spends are platform COGS, not user revenue, for that window. Per-turn token cost is UNCHANGED (same M1/M10 paths); the only new thing is who eats it. Bounded per user by the EXISTING `power` monthly allowance (61.7M units, `goblin-cap.ts`) + the Wave-D/K abuse caps, both applied to promo users unchanged → a promo user cannot cost more than a maxed `power` user (~$12–17.5/30d). Budget band (from the ledger's own figures): typical ≈ $2.5/user·30d, heavy ≈ $11, 20-user batch ≈ $50 typical / $220 heavy / ≤$350 ceiling. The redemption call itself is zero model tokens; the grant writes only `users.is_comped/comped_until/comp_reason/comped_at` (migration 0098, authored NOT applied) → no charge at expiry, honest degrade on read. Full row + cost table: M16 below. The PWA-install landing block (LAUNCH-ASSIST U1) is client-only UI → zero token/COGS, no row.**

**WAVE-F (Versionierung & Zeit — Checkpoints/Undo, 2026-07-17): ZERO MODEL TOKENS — a STORAGE-COGS mechanism only. NOTE, not an M-row (no token path). Every meaningful project change (auto before each agent run, on user "Stand sichern", on a VERIFIED publish) is snapshotted as a content-snapshot checkpoint (`services/checkpoints/checkpoint-store.ts`, migration 0095 `project_checkpoints` — authored, NOT applied). Storage model is content-addressed + dedup'd: file bytes live ONCE per unique content as a blob at `checkpoints/<projectId>/blobs/<sha256>`; the DB row carries only a lightweight manifest. So N snapshots of a mostly-unchanged project cost ~one blob set, not N copies (dedup gate: 10 checkpoints of a 20-file project = 1 blob set). Blobs are written UNMETERED (no `userId` on the write) → they are PLATFORM COGS (Goblin's internal safety net), NOT charged to the user's storage cap — an auto-snapshot the user never asked for must never eat their quota. The COGS is bounded by F5 retention: `pruneAgentAutoCheckpoints` (cron 03:45 UTC, `lib/cron.ts`) deletes agent-AUTO checkpoints older than `CHECKPOINT_RETENTION_DAYS` (default 30) except the pre-run snapshot of the last `CHECKPOINT_KEEP_LAST_RUNS` (default 20) runs, then GCs orphan blobs; ALL user + publish checkpoints are kept. Account/project deletion purges every checkpoint row + blob (`purgeProjectCheckpoints`, joined to the FW6-U3 blocking teardown + the single-project delete). Knobs: `CHECKPOINT_RETENTION_DAYS`, `CHECKPOINT_KEEP_LAST_RUNS` (`services/checkpoints/retention.ts`). CFO dependency: a small, bounded, prune-capped addition to B2 storage COGS (like project files), sized once prod shows checkpoint volume; NOT user allowance, NOT tokens. The restore path (`restore_checkpoint` agent tool + REST) and the F3 Zeitleiste UI are DB/storage reads + writes — zero model tokens; the tool is intent-gated (`classifyRestoreIntent`) so a build run never triggers it. Migration 0095 authored, NOT applied — founder applies.**

**LANDING-MESSAGING v2 · U6 (deutsche Landing + Toggle, 2026-08-18): KEINE ÄNDERUNG — null Model-Tokens, null externe Kosten, keine M-Zeile. NOTE nur, weil die stehende Regel jede Welle verlangt, auch die mit nichts zu verzeichnen. Die Welle ist ausschliesslich statisches Frontend: ein Copy-Dictionary (`components/landing/copy.ts`, EN+DE), eine zweite statisch vorgerenderte Route (`/de`, `app/de/page.tsx`), Sektionen auf einen `lang`-Prop umgestellt, plus CSS. Kein Model-Call, kein `completion_costs`-Eintrag, kein `platform_events`-Eintrag, keine neue externe Abhängigkeit, keine Migration. Die einzige Infrastruktur-Bewegung ist eine zusätzliche vorgerenderte HTML-Seite im Build (42 → 43 Seiten) — kein Laufzeit-Pfad, keine messbare Hosting-Position. Der DE·EN-Schalter setzt weiterhin nur die gespeicherte Sprachwahl (`lib/locale.ts`) und schreibt sie fire-and-forget aufs Konto (`persistLangToAccount`) — dasselbe Verhalten wie vorher, jetzt zusätzlich mit einem Link auf die passende Route. Dieselbe Klasse wie „The PWA-install landing block (LAUNCH-ASSIST U1) is client-only UI → zero token/COGS, no row" oben.**

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
- **U1 note (FINAL-POLISH — an abandoned chat turn now runs to completion; SMALL REAL INCREASE):** a client disconnect no longer aborts the upstream model stream. Before, `chat-sessions.ts` wired `c.req.raw.signal` into the completion's controller: locking the phone cut generation off mid-answer and — because persistence lives inside the `done` branch — threw the already-generated tokens away. Now the turn finishes and the answer is stored, so the user gets what they paid for. **The consumption change is the tail of an abandoned turn: the output tokens between the moment the socket dies and the model's natural stop.** Formula: `Δ = P(abandon mid-turn) × mean_remaining_output_tokens`. Both factors are **UNMEASURED** — no production telemetry distinguishes an abandoned turn today; the honest statement is that this is bounded by one turn's remaining output (single-digit thousands of tokens at worst, `M1` output shape), not by a loop. Note the offsetting effect, which is real but also unmeasured: the discarded answers were **already billed** and the user had to re-send, paying for the same turn twice — so some of this "increase" replaces a duplicate charge. **User allowance**, same completion, no new billing path. **Stellschraube:** `CHAT_MAX_RUNTIME_MS` (`apps/api/src/routes/chat-sessions.ts:28`, default 120000) is the new hard bound on an abandoned turn — the chat twin of `AGENT_MAX_RUNTIME_MS`; lower it to tighten. **CFO dependency:** A6 (exhaustion) only if the abandon rate turns out to be material — reconcile against `completion_costs` output tokens ~1 week post-merge, same protocol as the M10 F-40 note.
- **F-25 note (FW5-U6, input-side, negligible & self-funding):** the `responseStyle==='knapp'` branch of `renderUserContext` was tightened (1–3 Sätze + Verbot des Verkaufsabschlusses + ein Kurz-Few-Shot). The injected line grew from ~30 tok to **~120 tok — only when the user has selected "Knapp"** (zero otherwise), and it rides the already-cached static-ish prefix region for a warm user. Its whole purpose is to SHORTEN the model's OUTPUT (the expensive side at $0.294/M out vs $0.147/M in for Swift), so the net token effect for a knapp user is negative. No new billing path, user allowance, same completion. Real-model probe 3/3 short (`evidence/fw5-u6/f25-knapp-probe.md`).
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

### M14 — Structure-context: import-graph summary (WAVE-E E1)
- **Trigger:** every turn in a **project-bound** chat/agent run **where the project has parseable module structure** (≥1 JS/TS/JSX/TSX/Vue/Svelte source with an `import`/`export`/`require`). A vanilla static HTML/CSS/JS project has **no module edges** → `renderProjectGraph()` returns `''` → **no block, M2 path byte-identical** (LIVE-USER rule; detection gate `hasModuleEdges()` `apps/api/src/services/import-graph.ts`).
- **Tokens:** +Δ input = a compact one-line-per-file dependency graph (`path · nutzt: … · Pakete: … · exportiert: …`), rendered inside the shared `renderProjectContext()` (`apps/api/src/prompts/goblin-chat-system.ts`), so it rides BOTH chat and agent turns. **MEASURED 2026-07-17** on a realistically-formatted 15-file React/Vite app (the E4 shape) via `src/services/import-graph.test.ts`: **graph = 981 chars ≈ 245 tok**; the same project's full-content injection = **6,054 chars ≈ 1,514 tok** → **6.2× cheaper**, and the graph is **2.0% of the 48k M2 char budget**. The graph scales with file **count**, not file **size**, so the ratio grows on larger projects (fixed ~250 tok map vs an ever-growing content dump).
- **Honest correction to the SPIKE estimate:** the spike's FORMULA figure was "~380 tok, ~25–30× cheaper." The real measurement is **245 tok and 6.2×** on this app. The ratio is lower than the estimate because the E4 task-list is a genuinely *small* real app (~6k chars of source, not the 30–60k the spike guessed); the token count is close. The measured number governs (Gesetz 2).
- **Billed to:** user allowance (same completion as M1/M2 — no new billing path). Net effect on a multi-file project vs the old blunt 48k dump: the map is cheap and full bodies are fetched **on demand** via the existing `read_file` tool, so a structured project trends **token-negative** vs injecting every body up front.
- **Knobs:** the graph line format + facet selection (`renderImportGraph()` `import-graph.ts`); scannable extensions (`SCANNABLE`); the M2 `FILE_CONTENT_BUDGET_CHARS = 48_000` still governs which bodies are *also* injected. **v1 limitation (honest):** the graph is built from files whose content is loaded under the M2 budget — a source that is itself over-budget contributes no edges yet (future: a lightweight graph-only read).
- **CFO dependency:** A19 family (project token split, same as M2), A6 (exhaustion) — measure with prod telemetry once framework projects are live. | Status: **MEASURED (1 sample)** — widen with prod telemetry.

### M15 — Full-stack backend provisioning (WAVE-B B1)
> **Numbering note (state-first):** the Wave-B prompt/spike called this row "M12", but **M12 is already taken** (Support agent, WAVE-J, above). Repo truth beats the prompt → this is **M15** (next free after M14). Same economics as the spike's draft.
- **Trigger:** the agent calls `provision_backend` during a build that needs persistence/login (JIT at the first backend-needing build). Advertised to a run **only** when `GOBLIN_FULLSTACK_ENABLED=true` (opt-in) — while off, this mechanism does not exist for any run and adds **zero** tokens/cost. Guard paths (no connected Supabase account → JIT connect signal; trial cap reached; schema invalid) short-circuit **before** any provider or model spend.
- **Tokens:** `provision_backend` itself is a **tool call, not a model completion** — it adds **zero** model tokens of its own. The only token effect is that a build which *chooses* to add a backend spends the normal agent-run tokens for the schema/RLS/client-wiring turn (already M10). The server generates the DDL deterministically (`fullstack/schema-sql.ts`) — the model never emits SQL, so no large SQL output tokens.
- **Billed to — SPLIT:** (1) **user allowance** — the agent-run model tokens for the provisioning+wiring turn (folds into M10; no new billing path). (2) **External infra — D-B1 = user-connected → $0 PLATFORM COGS:** the backend is created **inside the user's OWN Supabase account** (their free tier: 2 active projects, or their paid tier), so Goblin pays **nothing** per provisioned project, mirroring the own-Vercel model. There is **no `completion_costs`/`platform_cogs` write** for provisioning — nothing to bill.
- **Caps / knobs:** trial backend cap **D-B2 = 2** (`MAX_PROVISIONED_BACKENDS_TRIAL` `apps/api/src/lib/goblin-cap.ts`), paid guard 10 (`MAX_PROVISIONED_BACKENDS_PAID`), enforced from commit 1 in `fullstack/provision-tool.ts`; master opt-in `GOBLIN_FULLSTACK_ENABLED` + default region `GOBLIN_FULLSTACK_DEFAULT_REGION` (Frankfurt `eu-central-1`) (`fullstack/config.ts`). OAuth creds are env-only (`SUPABASE_OAUTH_CLIENT_ID/SECRET_RAILWAY`), never in code.
- **Cost:** per-provisioning platform COGS = **$0** (user-connected). Trial exposure = `trial_users × D-B2 (2) × $0 = $0`. The only marginal cost is the agent-run tokens for the turn (already M10). **Alternative (sensitivity, NOT built):** platform-owned Supabase would be ~$10/active project/month (no idle-pause) — the reason user-connected was chosen (see `_sprint/wave-b/SPIKE_DECISION_TABLE.md`).
- **CFO dependency:** **none material** — user-connected provisioning creates no platform COGS line. Provisioning latency is **MEASURED at runtime** (`supabase_backends.provision_latency_ms`) — the spike could not verify a figure, so the real number lands here, never invented. | Status: **FORMULA** ($0 COGS by architecture; confirm zero platform-side spend once prod provisioning volume exists).

### M16 — Promo-code trial grants (LAUNCH-ASSIST U2)
- **Trigger:** a user redeems a promo code (`POST /api/promo/redeem` → `redeem_promo_code()`, migration 0098) → their account is comped to the top tier (`power`) for `duration_days` (batch launch-1 = 30). During that window the promo user runs normal chat/agent turns like any paid user. **The redemption itself is ZERO model tokens** (a DB function call, no completion); the cost is the ordinary M1 (chat) / M10 (agent) turns the user then makes.
- **Tokens:** unchanged per turn — promo users hit the SAME M1/M10 paths at the SAME token cost as a paying `power` user. What changes is the **billing side**: a promo user pays nothing, so those tokens are **PLATFORM COGS**, not user revenue (a paying `power` user's tokens are revenue-backed; a promo user's are not).
- **Billed to — PLATFORM COGS (new exposure line):** promo users consume real DeepInfra tokens the platform eats for 30 days. Bounded per user by the **existing `power` monthly allowance (61.7M cost units, `goblin-cap.ts`) and the Wave-D/K abuse caps — both apply to promo users UNCHANGED** (verified: allowance follows `derivePlanTruth(...).allowanceKey = 'power'`, and the per-hour/day caps are plan-independent). So a single promo user's 30-day COGS is **capped by the power allowance**, not open-ended.
- **Cost table (computed FROM the existing ledger figures — Swift blended $0.20/M realistic, $0.162/M cached best, $0.283/M worst; M10 agent run 60–150k units ≈ $0.012–0.03/run; M1 6k-tok chat turn ≈ $0.0012):**
  - **Typical** active test user (≈3 builds + 20 chat turns/day × 30d): `90×$0.02 + 600×$0.0012` ≈ **$2.5 / user / 30d**.
  - **Heavy** test user (≈10 builds + 60 chat turns/day × 30d): `300×$0.03 + 1800×$0.0012` ≈ **$11 / user / 30d** — which lands at the power-allowance ceiling (61.7M units × $0.20/M ≈ **$12.3**, worst-case no-cache × $0.283/M ≈ **$17.5**), i.e. the allowance is the natural per-user cap.
  - **20-user batch (launch-1 shape):** typical ≈ **$50**, heavy ≈ **$220**, absolute ceiling (all 20 max the power allowance) ≈ **$246** ($0.20/M) to **$350** (no-cache). The founder budgets from this band.
- **Knobs:** grant length + tier per batch (`promo_codes.duration_days` / `tier`, set at seed/`/admin/promo` batch generation); the COGS ceiling per user is the `power` row of `GOBLIN_MONTHLY_ALLOWANCE` (`apps/api/src/lib/goblin-cap.ts`) + the Wave-D caps (`abuse-caps.ts`) — all unchanged. Founder kill-switch: `promo_codes.revoked`.
- **No charge at expiry:** the grant writes only `users.is_comped/comped_until/comp_reason/comped_at` — no Stripe customer/subscription/card — so nothing can charge a promo user, at expiry or ever. At expiry `derivePlanTruth` degrades the account to trial/none on read (no cron). Verified: `plan-truth.test.ts` + `evidence/launch-assist/promo-lifecycle-gate.md`; real-Stripe money suites stay 17/17.
- **CFO dependency:** a NEW small platform-COGS line = `active_promo_users × (typical…ceiling per user)`. Size it once prod shows real promo-user token volume (reconcile against `completion_costs` for comped accounts). | Status: **FORMULA** (per-turn costs reuse MEASURED M1/M10 figures; per-user rollup is an activity assumption — confirm with prod telemetry for comped accounts).

### M-H1 — Hosting COGS class: Living-App storage & routing on the lean Cloudflare plane (AKT 2 · Phase 1 · U1.2)
**ZERO MODEL TOKENS.** This is the first row of a new cost family — *hosting* COGS, not inference COGS. No completion, no `completion_costs` row, no user allowance is touched by anything in `apps/api/src/services/cf-deploy.ts`. It is registered here because it is the substrate bill Act 2 creates, and because the standing rule is "cost-relevant mechanism → ledger line in the same commit".

- **Trigger:** every adapter call that touches Cloudflare — `putAppFiles` / `listAppFiles` / `getAppFile` / `deleteAppFiles` (R2 via the S3 API), `setRoute` / `getRoute` / `deleteRoute` (KV via the CF REST API), `deployWorker` / `getWorker` / `deleteWorker` / `listWorkers` (Workers via the CF REST API), plus `checkR2` / `checkKvNamespace` / `listWorkers` from the `/api/ops/health` probe. **In Phase 1 the only callers are the health probe and the U1.5 self-test — no user path calls this yet, and `OPS_HOSTING_ENABLED=false` means no path can.**
- **Substrate & plan (founder decision 2026-07-27, amending D2 of `OPS_SPIKE_0_DECISION_TABLE.md` §5.2):** Cloudflare **Workers FREE**. No Workers for Platforms, no dispatch namespace, no $25/mo subscription, no per-app Workers, no D1. **Committed fixed cost for this plane: $0.00/month.** The Free plan's **100,000 requests/day account-wide hard stop is the cost ceiling by design** — see the availability note below, which is the honest cost of that choice.
- **Formulas (list rates, retrieved 2026-07-25, per `OPS_SPIKE_0_DECISION_TABLE.md` §1.2 — NOT re-fetched this session):**
  - R2 storage — `GB-month × $0.015`, first **10 GB-month free**.
  - R2 Class A (write/mutate: PutObject, DeleteObjects, ListObjectsV2) — `requests ÷ 1e6 × $4.50`, first **1,000,000/month free**.
  - R2 Class B (read: GetObject, HeadBucket) — `requests ÷ 1e6 × $0.36`, first **10,000,000/month free**.
  - R2 egress — **$0.00** (Cloudflare charges no egress or bandwidth on R2).
  - Workers KV + Workers requests on the Free plan — **$0.00 up to the plan's daily limits**; there is no overage price on Free, there is a **stop**.
  - **One publish of an N-file app** = N Class-A writes + (on republish) 1 list + ⌈M/1000⌉ Class-A deletes. A 20-file app publishes for **20 ÷ 1e6 × $4.50 = $0.00009** at marginal rates, and **$0.00** inside the free allowance.
- **Marginal cost per Living App:** at the Phase-3 target of 150 apps × 100 MB = 15 GB → 5 GB beyond the free 10 GB → `5 × $0.015` = **$0.075/month total**, i.e. **≈ $0.0005 per app per month**. Serving traffic adds Class-B reads only after 10M/month across the whole fleet. **The binding constraint on this plane is not money — it is the 100k-requests/day Free stop.**
- **Billed to:** **PLATFORM COGS.** No user quota, no allowance, no per-user metering — deliberately, because a Living App's storage is Goblin's hosting product, not the user's project-file quota (which stays on B2, unchanged). The per-plan Living-App *count* endowment (Blueprint B1) is the user-side limit; it is not implemented in this phase.
- **Knobs / adjustment levers (all `apps/api/src/services/cf-deploy.ts` unless noted):** `OPS_HOSTING_ENABLED` — the global kill switch; false (its default and its state at this merge) means **zero** hosting COGS, because no path reaches the adapter (`services/ops-beta.ts`). `CF_R2_BUCKET` / `CF_KV_NAMESPACE_ID` — which substrate objects are billed. `CF_TIMEOUT_MS` (default 10,000) — bounds how long a hung Cloudflare call holds a Railway request, i.e. it is a *Railway* cost lever, not a Cloudflare one. `DELETE_BATCH_SIZE` (1000, the S3 maximum) — deleting a 2,500-file app costs 3 Class-A requests, not 2,500. Storage is reclaimed only by `deleteAppFiles`; **there is no retention/GC job yet** — Phase 2 owns unpublish, and an orphan-app sweep is unbuilt (recorded under HONEST LIMITATIONS, not assumed away).
- **HONEST AVAILABILITY NOTE (the real cost of Free, stated plainly):** the Workers Free plan stops serving at **100,000 requests/day, account-wide** — shared across every Living App and the router Worker. *(Provenance: this figure is INHERITED from the founder's lean-substrate decision record of 2026-07-27 and was **not** re-fetched from Cloudflare's live docs in the session that authored this row — unlike the R2 rates above, which carry the spike's 2026-07-25 retrieval date. Confirm it against the live Workers pricing page before it is quoted to a user or used in a plan.)* Past that, apps return Cloudflare's error until UTC midnight. This is **accepted** as the cost ceiling: it cannot produce a surprise bill, only a surprise outage. It also means the fleet has **no per-app fairness** — one app's traffic spike can exhaust the day for every other app. Both facts must be told honestly to any user before their app is on this plane, and neither is mitigated in Phase 1.
- **Documented upgrade trigger (the escape hatch, decided in advance so it is not decided in a panic):** move to Workers Paid ($5/mo) / Workers for Platforms ($25/mo) + D1 when **either** the Free daily limit actually bites (measured, from the Cloudflare dashboard — not predicted) **or** a user app needs server-side code. The adapter interface is substrate-agnostic precisely so this is an added implementation, not a rewrite. At that point re-run `OPS_SPIKE_0_DECISION_TABLE.md` §2 with **measured** numbers: A1 (5 CPU-ms/request) is still unmeasured and is that model's largest unverified input.
- **CFO dependency:** a new **hosting-COGS** line, distinct from the inference lines above. Today it is **$0.00 fixed + ≈$0.0005/app/month marginal**, and it is $0.00 in total while the kill switch is off. When Phase 2 puts real apps on the plane, size it from the Cloudflare dashboard's own usage figures rather than from these list-rate formulas. | Status: **FORMULA** (arithmetic from documented list rates; **no Cloudflare invoice, dashboard or usage figure has been observed** — nothing on this plane has been billed or measured yet).

#### M-H1 · Phase-2 amendment (AKT 2 · Phase 2 — hosted publish) — 2026-07-28

**No formula above changes.** Phase 2 turns the adapter from something only a probe called into something a real publish calls, so what changes is *who triggers the existing rates*, plus one new mitigation. Recorded here in the same commit, per the standing rule.

- **New callers (the first non-probe ones):** the publish path (`ops-publish.ts` → `putAppFiles`, `setRoute`), the operator path (`ops-operator.ts` → `setRoute`, `deleteRoute`, `deleteAppFiles`, `listAppFiles`, `listAppPrefixes`), the router Worker (R2 `get` per served file, KV `get` per request), and the E2E runner (`ops-e2e.ts`). Still gated: `OPS_HOSTING_ENABLED=false` and the beta allowlist both have to be open before any of them runs.
- **The pre-publish scan is $0.** `hosted-publish-scan.ts` is a deterministic ruleset over the artifact's own bytes: **no model call, no external service, no `completion_costs` row, no user allowance touched.** It costs the CPU of a few regexes on an artifact we are already holding in memory. This is the ledger note the phase prompt asks for, and it is the whole cost of satisfying the AUP's "automatische Prüfungen" claim. **When the Swift classifier lands in Phase 3, THAT gets its own M-line** — an inference cost per publish is a different cost family and must not be folded into this row.
- **Serving cost per request, at list rates:** 1 KV read (Free plan, $0.00 up to the daily limit) + 1 R2 Class-B read per file served (`requests ÷ 1e6 × $0.36`, first 10M/month free). A 5-file page view is 5 Class-B reads. Hashed assets are served `immutable`, so repeat views are answered by the browser and by Cloudflare's cache rather than by R2 — the Class-B count is per cache miss, not per page view. Refusal pages (404/410/429/suspended) touch **neither** R2 nor the counter: they are generated in the Worker.
- **NEW MITIGATION — the per-app daily request budget (U2.6, spike F3):** `ops-caps.ts` sets `free-static = 10,000 requests/app/day`, enforced at the router from a KV counter, answering an honest 429 past it. This does **not** change any rate; it bounds the multiplier. It is the first mitigation for the "no per-app fairness" hole named in the availability note above: one app can no longer silently consume the account's whole 100k/day. **The arithmetic, stated honestly: at 10,000/app/day, ten simultaneously-busy apps still exhaust the account's daily allowance.** That is a beta-scale number, tunable in code without a migration (which is why 0099 stores `caps_profile` as a name), and it should be revisited the moment the beta widens.
- **HONEST LIMIT OF THAT MITIGATION:** the counter is **coarse**. KV reads are eventually consistent with a 60-second per-colo cache and writes propagate asynchronously, so under a burst it undercounts and an app can serve materially more than its budget before the limit bites. It bounds sustained runaway traffic over hours; it is **not** a rate limiter and must not be quoted as one. A precise counter needs a Durable Object, which is not on the Free plane.
- **The orphan hole is now measurable, not closed by assumption.** The Phase-1 note said "an orphan-app sweep is unbuilt". `findOrphanedApps()` (U2.5) now lists R2 prefixes with no registry row — so unaccounted storage can be *found* and explicitly purged. It is report-only by design; nothing deletes automatically. Storage is still reclaimed only by an explicit teardown, and there is still no retention/GC job.
- **PHASE-3 POINTER (added 2026-08-13):** the sentence “the pre-publish scan is $0” above is still true of the **deterministic** scan and of this hosting-COGS row, which remains zero-token. It is **no longer the whole of the hosted scan**: Phase 3 adds a second stage that spends Swift tokens, registered separately as **M-A2** exactly as this amendment promised. This row’s formulas are unchanged; the inference cost lives there.
- **Status: unchanged — FORMULA.** Phase 2 adds real callers but **no Cloudflare invoice, dashboard reading or usage figure has been observed yet.** The first real numbers come from the founder's U2.8 window (`docs/AKT2_PHASE2_FOUNDER_WINDOW.md`); until then every figure in this row remains arithmetic from list rates, not measurement.

### M-A1 — Auth mail delivery moved onto Resend (AKT 1 · FEHLERSTRANG-1 · U3)
**ZERO MODEL TOKENS.** No completion, no `completion_costs` row, no user allowance is touched. Registered because it MOVES a delivery volume from one provider's quota to another's, which is a real consumption change even though the marginal price is currently $0.00.

- **Trigger:** every transactional auth mail Supabase would previously have sent itself — password reset, signup confirmation, email-change (both halves), magic link, invite. With the Send-Email hook enabled, Supabase calls `POST /api/auth/email-hook` instead and the mail goes out through the existing `lib/email.ts` Resend client. With the hook NOT enabled (its state at this merge), nothing changes: Supabase keeps sending, and this row is $0.00 and zero volume.
- **Formula:** `auth_mails/month = password_resets + signups + email_changes + magic_links`. One Resend send per mail, one-to-one — the hook adds no fan-out, no retry loop, and no digest batching.
- **Rate:** Resend's free tier is the binding allowance and it is SHARED with the mails Goblin already sends through this same client (support escalation, founder digest, feedback). *(Provenance: the tier's numeric limits are NOT re-fetched or quoted here — read them off the Resend dashboard before using them in a plan. What this row asserts is only the SHAPE: auth mail now draws on the same shared allowance as the existing transactional mail, where before it drew on Supabase's separate built-in mailer.)*
- **Billed to:** **PLATFORM COGS.** No user quota, no per-user metering — auth mail is not a feature a user consumes, it is how they get into their account.
- **Knobs / adjustment levers:** `SUPABASE_AUTH_HOOK_SECRET` (unset ⇒ the hook refuses every call ⇒ Supabase keeps sending ⇒ zero Resend volume from this path — this is the kill switch, and its default); the dashboard toggle for the hook itself; `RESEND_FROM` (sender identity, no cost effect); `NEXT_PUBLIC_APP_URL` (link origin, no cost effect).
- **Second-order effect worth stating:** the previous path was Supabase's built-in mailer, whose own per-hour send limit is low by design. Moving off it removes that limit as a signup-burst ceiling — a capacity gain, not a cost, but it is the reason the change matters beyond deliverability.
- **CFO dependency:** none today. If auth-mail volume ever pushes the shared Resend allowance into a paid tier, that becomes a real fixed line — size it from the Resend dashboard's own figures, not from an estimate here. | Status: **STRUCTURAL** (mechanism authored and unit-tested; **no Resend invoice, dashboard figure or production send through this path has been observed** — the hook is not enabled yet).

### M-A2 — Swift abuse classifier: stage 2 of the hosted pre-publish scan (AKT 2 · Phase 3 · U3.1)

> **Numbering note (state-first, same resolution as M15).** The Phase-3 prompt asks for this row under
> the label **“M-A1”**. **M-A1 is already taken** — it is the Resend auth-mail row directly above, merged
> with AKT 1 · FEHLERSTRANG-1. Repo truth beats the prompt, so this is the next free label in that
> series, **M-A2**. It is also the row that M-H1’s Phase-2 amendment promised in writing: *“When the
> Swift classifier lands in Phase 3, THAT gets its own M-line — an inference cost per publish is a
> different cost family and must not be folded into this row.”* Anyone looking for “M-A1 · classifier”
> is looking at this section.

**THE FIRST ACT-2 MECHANISM THAT SPENDS MODEL TOKENS.** Every Act-2 row before this one (M-H1 hosting,
and the K3 half of M13) is explicitly zero-token. This one is not, which is why it gets a row rather
than an amendment.

- **Trigger:** one Swift completion per hosted publish attempt that **reaches stage 2** — i.e. the
  deterministic stage-1 scan already answered `pass`. A stage-1 **block spends nothing**: stage 2 never
  runs on a decided refusal (`runHostedPublishScan`, `apps/api/src/services/safety/hosted-publish-scan.ts`).
  Also zero when `OPS_HOSTING_ENABLED=false` (no publish path reaches the scan at all) or when
  `OPS_SCAN_CLASSIFIER_ENABLED=false`. **Not** triggered by the Vercel publish path — K3 there is
  unchanged and still deterministic-only (M13).
- **Formula:** `input_tokens = system_prompt (fixed) + extracted_artifact_text` ·
  `output_tokens ≤ CLASSIFIER_MAX_OUTPUT_TOKENS (200)` · `cost = (input + output) × Swift unit price`.
  Extracted text = every readable file of the artifact (HTML/JS/TS/JSON/MD/TXT), markup kept, whitespace
  runs collapsed, concatenated with `--- path ---` separators. **1 Swift token = 1 cost unit** (unit
  system above), so this mechanism’s units are its tokens, unweighted.
- **FIRST DATA POINT — MEASURED 2026-08-13, and labelled honestly.** These are **fixture measurements of
  input SIZE**, taken by running `extractCandidateText()` over the checked-in battery
  (`apps/api/src/services/safety/__fixtures__/hosted-publish/`, the same nine artifacts the Phase-2 scan
  battery uses). **They are not a production average, and they are not provider-billed usage** — no
  DeepInfra invoice, dashboard figure or `completion_costs` row for this path has been observed.
  - Fixed system prompt: **2,185 chars ≈ 547 est. tokens**, paid on every stage-2 call.
  - Candidate text, the **six** fixtures that reach stage 2 (the three hostile ones are blocked at
    stage 1 and cost nothing): **110 · 156 · 157 · 127 · 163 · 262 est. tokens** → **mean 163, max 262**.
  - **Per-scan input ≈ 710 est. tokens** (547 + 163) for a fixture-sized app; output is a single small
    JSON object, capped at 200 and observed far below it.
  - **≈ $0.00015 per scan** at the realistic Swift mix ($0.20/M): `740 ÷ 1e6 × $0.20`. At the worst
    no-cache rate ($0.283/M): ≈ $0.00021. **(Superseded by the measured figures in the next bullet —
    kept because the gap between the two is the useful part.)**
  - **Estimation caveat, stated rather than buried:** “est. tokens” is `chars ÷ 4`
    (`CHARS_PER_TOKEN_ESTIMATE`), the conventional prose divisor. Markup is denser than prose, so this
    runs **low** on HTML. The numbers that will eventually reconcile against the CFO dashboard are the
    provider’s own `usage` fields, which the classifier already records
    (`ClassifierResult.tokens.input/output`) — not these.
- **SECOND DATA POINT — REAL PROVIDER USAGE, MEASURED 2026-08-13.** The row above was authored from
  `chars ÷ 4` and said so; the stage-2 battery gate (`apps/api/scripts/scan-battery-stage2.mts`) then
  ran **50 real Swift completions** against DeepInfra and reported what the provider actually billed.
  These numbers supersede the estimates for costing purposes:
  - **Mean input: 916 tokens/scan. Mean output: 19 tokens/scan.** (50 calls, 10 fixtures × 5 runs.)
  - **The estimator runs ~23 % LOW on markup** — 710 est. vs 916 real, the direction the row above
    predicted and the reason `ClassifierResult.tokens` records the provider's figures.
  - **≈ $0.00019 per scan** at the realistic Swift mix ($0.20/M): `935 ÷ 1e6 × $0.20`. At the worst
    no-cache rate ($0.283/M): ≈ $0.00026.
  - **The gate run itself cost ≈ $0.01** (50 calls × ~935 tok). Recorded here because it is real spend
    and because M13 set the precedent for logging a one-off eval's cost
    (`scripts/wave-k-refusal-gate.mts`, 8 completions, ~$0.001).
  - Evidence: `evidence/akt2-phase3/stage2-battery.json` — the run's own report, from which every
    number in this bullet is read.
  - **Still not a production average.** Ten fixture-sized apps, one model, one day. A real hosted app
    is bigger than a fixture, so the per-scan figure will rise toward the cap below.
- **Ceiling per scan (the hard cap, which is the real cost control):** `CLASSIFIER_MAX_INPUT_TOKENS`
  = **6,000 est. tokens** of candidate text. An artifact whose text exceeds it is **not truncated and
  classified anyway** — it is held for human review with **zero tokens spent**. So the arithmetic worst
  case for one scan is `6,000 + 547 + 200 = 6,747 tokens` ≈ **$0.00135** ($0.20/M) to **$0.0019**
  (no-cache), and there is no input shape that can exceed it.
- **Billed to — PLATFORM COGS, not the user’s allowance (founder decision, CONFIRMED 2026-08-13 as
  escalation E1 of the Phase-3 report: scanning is platform COGS and is never billed to a user’s
  quota).** Scanning is
  something Goblin does for its **own** protection as the hoster; charging a builder’s monthly quota for
  the privilege of being checked would be billing them for our liability. Concretely: this path does not
  go through `model-router.ts`, writes **no `completion_costs` row**, and is therefore invisible to
  `goblinWeightedUsage()` / `isOverMonthlyAllowance()`. **The honest consequence of that choice, stated
  plainly: this spend is not currently metered anywhere.** It is bounded per call by the cap above and
  per day by how many publishes an allowlisted beta account can make, and that is the whole of the
  control today. A metered path (its own `platform_cogs` line) is the right follow-up the moment this
  leaves the beta allowlist.
- **Knobs / adjustment levers** (all `apps/api/src/services/safety/abuse-classifier.ts` unless noted):
  - `OPS_SCAN_CLASSIFIER_ENABLED` — stage-2 kill switch. `false` ⇒ **zero tokens**, publish behaves
    exactly as Phase 2 (deterministic layer alone). Default ON.
  - `OPS_SCAN_CLASSIFIER_MAX_TOKENS` (default 6,000) — the hard input cap above; the single biggest
    lever on both cost and how often an app lands in review.
  - `OPS_SCAN_CLASSIFIER_TIMEOUT_MS` (default 20,000) — per-call deadline; a Railway-time lever, and a
    timeout costs the provider-side tokens of an abandoned call.
  - `CLASSIFIER_MAX_OUTPUT_TOKENS` (200, code constant) — the output ceiling.
  - `CLASSIFIER_SYSTEM_PROMPT` — every edit to it changes the fixed per-scan input cost; the 547-token
    figure above is measured against the version in this commit.
  - `OPS_HOSTING_ENABLED` / `OPS_BETA_ACCOUNTS` — upstream of everything: with the switch off, no
    publish reaches the scan and this mechanism costs $0.00.
- **Second-order effect worth stating:** the failure direction is deliberately expensive in *human* time
  rather than in money. Provider down, over budget, unparseable answer → **review**, never a silent pass.
  A DeepInfra outage therefore does not raise this bill — it fills the founder’s review queue instead.
- **CFO dependency:** a NEW small **platform-COGS** line, `stage-2 scans/month × ≈$0.00015` at fixture
  size, hard-capped at `× $0.0019`. At beta scale it is arithmetically negligible (10,000 scans ≈ $1.50
  realistic, ≈ $19 at the absolute per-scan ceiling); it is registered because the standing rule is
  “cost-relevant mechanism → ledger line in the same commit”, not because it is currently material.
  | Status: **MEASURED (50 real completions, 2026-08-13)** — provider-billed usage HAS now been
  observed for this path, from the stage-2 battery gate; the dollar figures remain arithmetic from the
  unit prices above. What is still unobserved is **production** volume: how many hosted publishes per
  month reach stage 2. Reconcile once the founder window and real beta traffic exist.

### M-F1 — Per-app form storage: D1 databases on the Workers Free plan (AKT 2 · Phase 4 · U4.1)

**ZERO MODEL TOKENS.** No completion, no `completion_costs` row, no user allowance. This is a second
row of the *hosting* COGS family M-H1 opened, and it is registered separately rather than folded in
because it is the row where Goblin starts holding **other people's personal data**, which has a cost
shape M-H1 does not: it grows without anybody at Goblin doing anything, and it cannot be reclaimed by
deleting a cache.

> **LATE BY ONE COMMIT, stated rather than tidied away.** The standing rule is "cost-relevant
> mechanism → ledger line in the SAME commit". The D1 mechanism landed in the U4.1 commit and this row
> lands in the U4.5 one. That is a real miss against the rule; recording it here is cheaper than a
> rewritten history that pretends otherwise.

- **Trigger:** one database created per app, at the FIRST form-enabled publish (`ops-d1.ts` →
  `provisionAppDatabase`). An app with no form never gets one. Thereafter: one `INSERT` per accepted
  submission plus one counter `UPSERT`, and reads only when the owner opens their inbox or exports.
- **Substrate & plan — CHECKED AGAINST LIVE DOCS 2026-08-13, not recalled:** Cloudflare **D1 on the
  Workers FREE plan**. `https://developers.cloudflare.com/d1/platform/limits/` and
  `/d1/platform/pricing/`:
  - **10 databases** (Free) / 50,000 (Workers Paid)
  - **500 MB** per database (Free) / 10 GB (Paid)
  - **5 GB** total storage (Free)
  - **5,000,000 rows read/day** (Free)
  - **100,000 rows written/day** (Free)
  - **Committed fixed cost: $0.00/month.** M-H1's "no committed spend" survives Phase 4 intact.
- **THE PREFLIGHT'S PREMISE WAS WRONG, AND IT MATTERS FOR THE DECISION.**
  `docs/ACT2_PHASE4_PREFLIGHT.md` §6 records P4-a on the premise that a per-app database means
  "Workers Paid oder WfP, eine neue feste Kostenzeile". Against live docs it does not: D1 is on the
  Free plan, and the documented upgrade trigger in M-H1 ("the Free limit bites OR an app needs
  server-side code") is **not** fired by this phase. No app runs server-side code — the platform API
  does the writing. The substrate did not change; it gained a product that was already on the plan.
- **What the Free plan DOES impose, and it is real: TEN DATABASES.** That is a hard ceiling of ten
  form-enabled apps across the whole account. It is enforced honestly rather than discovered
  (`D1_FREE_PLAN_DATABASE_LIMIT`): the eleventh form-enabled publish is REFUSED with a German sentence
  naming the ceiling, and publishing the same app WITHOUT a form still works. **Going past ten is a
  founder decision with a price: Workers Paid at $5/month.** It is one constant in one file so the day
  that decision is taken is a one-line day.
- **Formulas (Workers Paid rates, for the day the ceiling is raised — list rates as at the retrieval
  above, NOT an invoice):** rows read `first 25e9/month included, then $0.001/1e6`; rows written
  `first 50e6/month included, then $1.00/1e6`; storage `first 5 GB included, then $0.75/GB-month`.
- **Arithmetic at the beta's own ceilings:** 10 apps × the 500/month cap = **5,000 rows written per
  month**, against a Free allowance of **100,000 per DAY**. Three orders of magnitude of headroom.
  A submission is ≤ 16 KB, so 5,000/month ≈ **80 MB/month** across the fleet against 5 GB. **The
  binding constraint on this row is the database COUNT, not bytes and not operations.**
- **Billed to: PLATFORM COGS.** Not a user quota. Same reasoning as M-H1: a Living App's storage is
  Goblin's hosting product. The per-app 500/month cap (M-F-adjacent, `ops-caps.ts`) is the user-side
  limit, and it exists to bound how much of a stranger's data one form collects — not to meter a
  resource.
- **Knobs:** `D1_FREE_PLAN_DATABASE_LIMIT` (10) · `CAPS_PROFILES['free-static'].monthlySubmissions`
  (500, a planning number) · `OPS_FORMS_ENABLED` (fleet kill switch — off means zero new rows, though
  existing databases keep their storage) · `CF_R2_JURISDICTION` (governs D1's jurisdiction too; an
  unhonourable value REFUSES provisioning rather than creating a database outside the residency the
  privacy page claims).
- **RECLAMATION IS PROVEN, NOT ASSUMED — the difference from M-H1's Phase-1 state.** M-H1 shipped with
  "there is no orphan sweep" as an honest limitation. This row does not: `teardownApp` deletes the
  database and RE-READS it, a database that is not verifiably gone blocks the project delete with a
  409, and `findOrphanedApps()` lists databases with no registry row. Storage that outlives its app is
  findable on day one.
- **CFO dependency:** none today, $0.00 committed. The line to watch is not a dollar figure, it is a
  COUNT: at ten form-enabled apps the beta stops being able to grow without a $5/month decision.
  | Status: **FORMULA** (limits and rates from live docs retrieved 2026-08-13; **no D1 database has
  been created, no dashboard figure observed** — nothing on this plane exists until the founder window
  runs).

### M-F2 — Turnstile: the spam layer on the form ingest (AKT 2 · Phase 4 · U4.3)

**ZERO MODEL TOKENS. ZERO DOLLARS.** Registered anyway, because a dependency with no invoice is still
a dependency, and because this one has a failure mode that is a cost of a different kind.

- **Trigger:** one `POST` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` per form
  submission that has already passed the local layers (kill switch, registry, origin, shape, rate
  limit). A refusal at any of those costs **zero** siteverify calls — the rate limit is deliberately
  ordered *before* Turnstile so a flood cannot buy one upstream call per request.
- **Rate: $0.00.** Free tier: unlimited challenges, 20 widgets, 10 hostnames per widget
  (`OPS_SPIKE_0_DECISION_TABLE.md` §2.4, re-checked in the Phase-4 preflight §2). There is no paid
  tier in play and no overage.
- **Billed to:** nothing. There is no bill.
- **The cost that is NOT money — stated because it is the one that can hurt:** this is an external
  dependency in the path of every submission, with a 5-second per-call timeout. When it is
  unreachable, the ingest **fails closed** and real visitors are turned away with an honest message.
  That is a deliberate availability trade: an ingest that fails OPEN under load is an ingest a flood
  can switch off. The alternative cost — accepting unverified traffic into strangers' inboxes — is
  worse than a form that is briefly honest about being unavailable.
- **Knobs:** `CF_TURNSTILE_SECRET_KEY` (absent ⇒ every submission refused, loudly logged — NOT
  accepted) · `CF_TURNSTILE_SITE_KEY` (absent ⇒ the publish path refuses to wire a form at all, rather
  than shipping a widget with no key) · `OPS_FORMS_ENABLED`.
  | Status: **STRUCTURAL** (mechanism authored and unit-tested; **no production verification has been
  performed** — the widget exists in the founder's Cloudflare account but no real challenge has been
  verified through this code).

### M-F3 — Owner notification for form submissions (AKT 2 · Phase 4 · U4.5)

**ZERO MODEL TOKENS.** No model writes a word of these mails: the templates are fixed German strings
and the only variable content is what a visitor typed, HTML-escaped. Registered because it adds a real
**send volume** to the shared Resend allowance M-A1 describes.

- **Trigger:** one Resend send per ACCEPTED submission, plus one per app per hour when a burst crosses
  the threshold, plus one per app per hour when the monthly cap is reached.
- **Formula:** `sends/month ≈ accepted_submissions + burst_notices + over_cap_notices`, and the first
  term is **hard-bounded by the cap**: at 500 submissions/app/month across 10 form apps, the ceiling is
  **5,000 sends/month** from this path, fleet-wide. The burst brake pulls the realistic number well
  below that — past 10 mails in an hour for one app, individual sends stop and one notice takes over.
- **Rate:** Resend's free tier is the binding allowance and it is **SHARED** with M-A1's auth mail and
  with support/feedback/digest sends. *(Provenance: the tier's numeric limits are deliberately not
  quoted here — read them off the Resend dashboard before using them in a plan. What this row asserts
  is the SHAPE and the ceiling, not the headroom.)*
- **Billed to: PLATFORM COGS.** Following E1's principle: the owner did not ask for each of these
  mails, and a notification that their own product's form received something is not a feature they
  consume. **It is deliberately not a user-quota question**, and if it ever becomes one that is a
  founder decision, not an implementation detail.
- **HONEST LIMIT OF THE BURST BRAKE:** the counter is **in-process**. With several Railway instances
  the effective threshold is (instances × 10) per hour. It is a courtesy brake on a mailbox, not a
  quota, and the fleet-wide ceiling above — which is enforced in D1 and is exact — is the number that
  actually bounds the volume.
- **Knobs:** the per-app opt-out (`meta.notify` in the app's own database — the owner's switch, not
  ours) · `NOTIFY_BURST_THRESHOLD` (10/hour) · `RESEND_API_KEY` (absent ⇒ zero sends and a logged
  warning; the submission is still stored and still visible in the inbox) · the monthly cap, which is
  the hard ceiling on the first term.
- **One thing this row does NOT cover:** the over-cap mail is deliberately **not** silenced by the
  per-submission opt-out. "Stop mailing me every message" is a different wish from "do not tell me my
  form has stopped accepting messages", and collapsing the two would make a broken form silent.
  | Status: **STRUCTURAL** (authored and unit-tested; **no production send through this path has been
  observed** — the founder window is the first).

### M-K1 — The Keeper heartbeat: scheduled availability checks (AKT 2 · Phase 5 · U5.1)

**ZERO MODEL TOKENS, BY DEFINITION.** K0 is deterministic: an HTTP request, a TLS handshake, an RDAP
lookup and a `SELECT 1`. There is no prompt, no completion, no `completion_costs` row, and no branch
that could grow one. This is registered as the ledger's cheapest mechanism precisely so the claim is
on the record: **if a future edit needs an inference call to answer "is this app up", that is a design
smell to escalate, not a feature to add.** The one place a model belongs in the Keeper ladder is K1's
*one-sentence German explanation* of an incident (M-K2, Phase 6) — never the verdict.

- **Cost class: PLATFORM COGS.** Not a user quota, not metered, never charged against
  `goblinWeightedUsage()`. Same reasoning as M-H1 and founder decision **E1**: watching a Living App
  is Goblin's hosting product, and the owner did not ask for each individual check.
- **Committed fixed cost: $0.00/month.** M-H1's "no committed spend" survives Phase 5 intact. No new
  subscription, no new service, no new deploy target.
- **Trigger:** one in-process tick in the Railway API, waking every 60 s and measuring whatever is
  due. **ZERO Cloudflare cron triggers are used** — see the correction below, which is the reason.
- **THE CRON CEILING, CORRECTED AGAINST THE REPO.** The Phase-5 prompt states the Cron Triggers
  ceiling as 250 per account. `OPS_SPIKE_0_DECISION_TABLE.md` §2 (retrieved 2026-07-25 from
  `developers.cloudflare.com/workers/platform/limits/`) records **5 (Free) / 250 (Paid)**, and Goblin
  runs Workers **FREE**. Spike finding **F2** — "one cron per app does not scale" — therefore breaks
  at **five** apps, not 250. The fan-out design F2 demands was already the plan; the corrected number
  is why this row spends none of the five rather than one.

**THE REQUEST-VOLUME FORMULA** (the only cost dimension this mechanism has):

```
router requests/day = active apps × (1440 / cadence minutes) × API instances
```

Only the per-app `entry` check goes through the router and against the fleet's Workers budget. The
form-store check goes to the Cloudflare D1 API, the platform checks go to Vercel and Railway, and the
certificate probe is a bare TLS handshake — none of those invoke the router Worker.

- **The budget, and the cadence derived from it:** the heartbeat is allowed **5.000 requests/day**,
  which is **5 %** of the Workers Free account-wide ceiling of **100.000 requests/day** (`cf-deploy.ts:16`,
  M-H1 — *and inheriting M-H1's provenance caveat: that 100.000 figure comes from the founder's
  lean-substrate decision record and was not re-fetched from live Cloudflare docs in this session
  either*). The cadence is **derived from the fleet size** rather than fixed, so the share cannot
  drift: `cadence = clamp(roundUpTo5(apps × 1440 / 5000), 5 … 60)` minutes.
- **Arithmetic at the beta's own radius:** 10 active apps → 5-minute cadence → **2.880 router
  requests/day = 2,9 %** of the fleet ceiling. At the widest point of every cadence band the figure
  stays at or under 4.992/day (`ops-check-budget.test.ts` asserts each band).
- **Why a share at all — the spike measured this from the other side.** `OPS_SPIKE_0` §2.2, profile
  B: **8.640 of a typical app's 10.640 monthly requests — 81,2 % — are Goblin's own heartbeat.** At
  low traffic, which is most Living Apps, the monitoring IS the load. Cadence is a genuine cost lever
  and is treated as one.
- **The ceiling has a named owner, not a silent overrun.** At **209 active apps** the derived cadence
  has already hit the 60-minute floor and the budget is exceeded (5.016/day). The runner keeps
  watching and **reports `overBudget`**; the console renders it. Resolving it is founder decision
  **G-P5-1** (raise the share · Workers Paid at $5/month, which also resolves P6 and G-P4-1 · or
  stretch the cadence and change what is promised).
- **Storage, the other bounded cost:** `ops_app_checks` rows, pruned to **8 days inside the tick**
  (P5-e). At full beta occupancy — 10 apps, all form-enabled — that is **6.362 rows/day ≈ 51.000
  rows** standing, a few MB in Supabase. The prune runs in the tick because a cleanup with its own
  trigger is a cleanup that eventually stops running.
- **HONEST LIMIT — the instance multiplier is real and is not measured.** The runner is in-process,
  so N Railway instances run N fan-outs: N× the requests above and duplicate rows per subject. Same
  class as **P3** (the in-process form rate limiter). Nothing in this codebase can observe the
  instance count today, so the formula states the factor rather than pretending to a number. Carried
  forward, due the day the API runs more than one instance.
- **Knobs:** `OPS_CHECKS_ENABLED` (its own kill switch, default ON, ANDed with `OPS_HOSTING_ENABLED`)
  · `HEARTBEAT_DAILY_REQUEST_BUDGET` (5.000) · `MIN/MAX_CADENCE_MINUTES` (5/60) ·
  `CHECK_RETENTION_DAYS` (8) · `SUBJECT_MIN_INTERVAL_MS` (cert hourly, domain twice daily).
  | Status: **FORMULA** (mechanism authored and unit-tested; **no production tick has run, no row has
  been written, and no Cloudflare dashboard figure has been observed** — migration 0103 is unapplied
  and the founder window has not run. Every number in this row is derived from the shipped constants,
  not measured.)

### M17 — Auto-continuation of a truncated generation (TESTER-FEEDBACK U1)
- **Trigger:** a chat completion ends with the provider's finish reason **`length` / `max_tokens`** — the answer hit the per-request OUTPUT ceiling (`GOBLIN_MAX_TOKENS_PER_REQUEST = 8096`, `goblin-hosted.ts:179`; BYOK Anthropic/OpenAI send `max_tokens: 8096` at `model-router.ts:689/706`). The server then issues **one additional full completion request per continuation round** (`streamWithAutoContinuation`, `apps/api/src/services/stream-continuation.ts`) until the answer completes or the round cap is spent. **A generation that ends normally (`stop`) costs nothing extra — this row is zero for every answer that fits the ceiling**, which is the overwhelming majority of chat turns (M1/M2 shape unchanged).
  Second trigger, user-initiated: the **"Fortsetzen"** button on an answer that is still cut off after the cap (`continueTruncated: true` on `POST /api/chat-sessions/:id/stream` and `POST /api/chat/stream`). One tap = one round, and it can be repeated — so the user-initiated path is bounded by the user, not by the server.
- **Tokens per continuation round:**
  - **input** = the same system prompt as the parent turn (M2 file-context included) + the full history **+ the partial answer so far as an assistant turn** + the ~600-char resume instruction. The partial answer is the growth term: round *n* re-sends everything produced in rounds 0…*n−1*.
  - **output** = up to the same 8096 ceiling.
  - **FORMULA** (worst case, R = rounds actually run, P = base prompt tokens, C = 8096):
    `input_total ≈ (R+1)·P + C·R·(R+1)/2` · `output_total ≈ C·(R+1)`
    At the default **R = 3** and a typical P ≈ 6k: ≈ **24k + 48k ≈ 72k input, ≈ 32k output** for one very long answer — versus the ~14k/8k of a single ordinary turn. **At DeepInfra Swift rates (~$0.162/M blended) that worst case ≈ $0.017 per fully-continued answer.**
  - **Prompt caching softens the quadratic term:** each round's prefix is the previous round's prefix plus the appended assistant text, so the byte-stable head is cache-warm on DeepInfra (same mechanism as M10). The formula above is the **uncached** upper bound and is deliberately stated that way.
- **Billed to — USER ALLOWANCE (not platform COGS).** Every round is an ordinary `streamCompletion` call: it passes the goblin-hosted monthly-allowance and daily-guard gates and writes its own `completion_costs` row via `trackCompletion`. This is deliberate and is the honest side: **the tokens are spent on the user's answer**, so they count as the user's usage. The pre-stream gate means a user at their cap gets the calm refusal on the NEXT turn, never mid-answer (existing HR-3 behaviour, unchanged).
- **Stellschraube (knob):** **`MAX_CONTINUATION_ROUNDS`** — default **3**, read in `maxContinuationRounds()` (`apps/api/src/services/stream-continuation.ts:38`). **`0` disables auto-continuation entirely**: a truncated answer is then reported honestly on the first `done` and the user can still tap "Fortsetzen". Raising it raises the worst case quadratically — the formula above is the number to reason with. The second, blunter knob is `GOBLIN_MAX_TOKENS_PER_REQUEST` (raising the ceiling reduces how often continuation triggers at all, at the cost of a higher per-request maximum).
- **Measurement:** each continued answer emits a **`continuation_rounds`** `platform_events` row (`meta.rounds`, `meta.exhausted`) plus a structured log line. Frequency is the unknown in this row: the formula is exact per continued answer, but **what share of turns truncate has not been measured in production** — that is what the event is there to answer.
- **CFO dependency:** raises **A19 (user-allowance consumption)** for long-form/code turns only. No new external service, no new platform-COGS class. Reconcile after ~1 week of `continuation_rounds` events: `share of turns continued × mean rounds` → the real multiplier on M1/M2. | Status: **FORMULA** (constants VERIFIED in `stream-continuation.ts` + `goblin-hosted.ts:179`; stitching and cap behaviour unit-tested in `stream-continuation.test.ts` — **truncation FREQUENCY in production is unmeasured**, no `continuation_rounds` row has been written yet).

### M18 — Builder-Flow-Reparaturwelle (FOUNDER-WALK-7, 2026-08-18)

**Richtung: netto nach unten, mit einer kleinen, gedeckelten Gegenbewegung.** Keine neue
Verbrauchsklasse, kein neuer externer Dienst, keine neue Formel — deshalb eine Zeile und
kein eigenes Modell.

- **U3 (D-C) — Ersparnis, unbeziffert.** `POST /:sessionId/agent` und der klassische
  `/messages`-Pfad brechen jetzt mit 503 ab, wenn `hydrateSessionFiles` fehlschlägt
  (`apps/api/src/routes/code-sessions.ts`). Vorher startete der Lauf trotzdem — gegen einen
  leer *wirkenden* Workspace — und verbrauchte volle Modell-Tokens für eine Antwort, die auf
  nichts gebaut war (genau der Lauf, den der Founder als „keine Dateien · 114ms" sah, mit
  allem, was danach kam). Jeder so verhinderte Lauf spart einen kompletten Agent-Turn
  (M10-Klasse). **Häufigkeit unbekannt**: `session_hydrate_failed` wird geloggt, aber nie
  gezählt — die Ersparnis ist deshalb als Richtung belegt und als Zahl offen.
- **U4 (D-D) — Zusatzlast, hart gedeckelt.** `useCodeSessionDetail` wiederholt ein 429 auf
  `GET /api/code-sessions/:id` bis zu **3 Mal** (Retry-After beachtet, sonst 400ms · 2^n).
  Worst case: **3 zusätzliche GETs pro fehlgeschlagenem Detail-Load**, gegen die eigene API.
  Kein Modellaufruf, kein Drittanbieter, keine Tokens. Dieselbe Mechanik, die
  `fetchWithRetryOn429` (P1.10) für andere Aufrufe schon fährt.
- **U8 (D-G) — Bundle, nicht Verbrauch.** Ein zweites Shiki-Theme (`goblin-dark.json`, ~1 KB
  JSON) wird mitregistriert. Keine Laufzeitkosten ausser dem Parsen, kein Netzaufruf.
- **U2 / U5 / U6 / U7:** verbrauchsneutral. U2 fügt ein Feld zur POST-Antwort hinzu, U5 hält
  einen Turn clientseitig, U6 ändert ein Navigationsziel, U7 ändert Fehlertexte, ein
  HTTP-Status-Mapping und ein `console.error`.
- **CFO-Abhängigkeit:** keine. Kein neuer Posten, keine Änderung an A19/A20.
- **Nachmessen:** wenn `session_hydrate_failed` je gezählt wird, ist das die Zahl, die U3s
  Ersparnis beziffert. Bis dahin bleibt sie ehrlich unbeziffert.

Status: **DIREKT** (Codepfade verifiziert; Häufigkeiten unmessbar ohne Produktionszähler).

### M19 — Modell-Evaluierungs-Spike (SPIKE_MODEL_EVAL_2026-08, 2026-08-19)
- **Einmalige Plattform-COGS, NICHT wiederkehrend und keinem Nutzer berechnet.** Der Spike `docs/SPIKE_MODEL_EVAL_2026-08.md` hat 96 Probe-Calls (4 Modelle × 8 Proben × 3 Läufe) direkt gegen DeepInfra gefahren, um die Swift-/Forge-Kandidaten zu vermessen — **gemessene Ausgabe ≈ $0.639** (finaler Lauf $0.373164 + $0.265630 verworfene Teilläufe), Obergrenze $2.00, nicht erreicht. Läuft ausserhalb jedes Nutzerpfads (eigenes Wegwerf-Harness in `scripts/spike/`, importiert **keinen** Produktionscode), erzeugt keine `completion_costs`-Zeile, berührt weder Allowance-Gate noch `FORGE_WEIGHT` noch die Plan-Caps. **Keine CFO-Abhängigkeit, kein neuer Posten, keine Änderung an A19/A20** — der gemessene in:out-Ratio des Spikes (~0.04:1) ist ein Artefakt der Probenform (nackte Einzelprompts ohne System-Prompt/Dateikontext) und **taugt ausdrücklich NICHT zur Revision der 9:1-Annahme**. Status: **DIREKT** (96 Roh-Records, Preise live aus der DeepInfra-API).

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
