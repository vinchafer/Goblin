# I0 — INSTRUMENT pre-unit — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE, gate green.**

Measurement/attribution only — **no token consumption changed.**

## What shipped

### 1. `completion_costs.chat_session_id` populated (telemetry patch, applied-by-intent)
The prepared `_sprint/telemetry-0705/patches/chat-session-id.patch` was reconciled against
current master (anchors drifted; the interface/destructure/call-sites all moved but by symbol
were unambiguous) and applied via edits, not `git apply`:
- `model-router.ts`: `StreamCompletionParams.chatSessionId`, destructured, forwarded to **both**
  `trackCompletion` call sites (LiteLLM + direct-SDK branches).
- `chat-sessions.ts`: `POST /:id/stream` passes `chatSessionId: sessionId`.
- `track-completion.ts` already had the `chatSessionId` param + write (no change needed there).

### 2. Legacy-route gap closed via `project_id` (NOTES gap #1, option (a))
The legacy project route (`routes/chat.ts`) creates no `chat_sessions` row, so `chat_session_id`
stays NULL there. Closed by writing `completion_costs.project_id` **directly** from `trackCompletion`
(both routes already thread `projectId` through `streamCompletion`):
- Migration **`0077_completion_costs_project_id.sql`** — `add column if not exists project_id uuid`
  + index + `monthly_costs_per_user` view refreshed with the project dimension. **Authored, NOT applied.**
- `track-completion.ts` write is **pre-migration tolerant**: attempts insert with `project_id`; on
  error, retries WITHOUT it so the cost row is never dropped because the column is absent.
- Result: **every** new `completion_costs` row is attributable project-vs-standalone
  (`project_id` NULL = standalone). A19 becomes computable.

### 3. `platform_events` DB persistence (A20 + B2 measurable without Railway logs)
- Migration **`0078_platform_events.sql`** — table `(id, event_type, user_id, project_id, model,
  tokens_in, tokens_out, meta jsonb, created_at)`, `event_type` check =
  `('platform_cogs','context_retry')`, service-role RLS. **Authored, NOT applied.**
- New helper `lib/platform-events.ts` `insertPlatformEvent()` — **silent-fail**: never throws,
  no-ops when the table is absent (logs at debug).
- Producers wired:
  - both summarizer `internalBilling` sites in `model-router.ts` → `platform_cogs` (mirrors the
    existing `billing: platform_cogs` log line).
  - the B2 reduced-context retry in `token-limit-retry.ts` → `context_retry` (mirrors the console.warn).

## Gate I0 — unit tests (all green)
- `lib/track-completion.test.ts` (3): project chat writes `project_id` + `chat_session_id`; standalone
  is distinguishable (`project_id` null); **pre-migration retry drops `project_id` and keeps the row**.
- `lib/platform-events.test.ts` (3): maps columns for `platform_cogs` + `context_retry`; **no-ops
  (no throw) when the table is absent**.
- `__tests__/token-limit-retry.test.ts` (+assert): the forced retry fires exactly one
  `context_retry` insert carrying `userId`/`projectId`.

## Verification
- `npx vitest run` (apps/api): **37 files / 354 tests passed.**
- `npx tsc --noEmit` (apps/api): **clean.**

## Migration flags for the founder (apply in Supabase SQL Editor)
- `supabase/migrations/0077_completion_costs_project_id.sql`
- `supabase/migrations/0078_platform_events.sql`

Both idempotent, tolerant of not-yet-applied (API degrades to no-op / retries without the column).

## Ledger
`docs/GOBLIN_CONSUMPTION_LEDGER.md` updated same commit: top stamp + M2 (attribution path,
context_retry measurement) + M3 (platform_events A20 twin). No cost formula changed.
