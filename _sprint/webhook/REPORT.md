# Webhook Hardening — billing.ts — Sprint Report

**Branch:** `claude/webhook-hardening-3edkfc` · **Date:** 2026-07-08 · **Scope:** plumbing only
(no pricing/plan/amount/event-semantics changes). Money path already worked (0 failed
deliveries); this fixes LATENT fragility from observability ticket #12.

## State-first (Phase 0)
- Branch was even with `master` (no prior commits). Started clean.
- `apps/api/src/routes/billing.ts` webhook (drifted line numbers vs prompt):
  `constructEvent` at :406, `return {received:true}` at :487, outer catch `400 "Invalid
  signature"` at :488–489 — matched the prompt's diagnosis.
- Idempotency on `event.id` confirmed present (:412–431 pre-change) → async processing safe.
- Platform: **Railway**, long-lived Node process via `@hono/node-server` (not serverless) —
  so a post-response fire-and-forget promise runs to completion. In-process cron already
  exists (`lib/cron.ts`, gated `ENABLE_CRON=true`).
- `GET /health` already returns 200 (`routes/health.ts:9`).

## Units delivered

### WH1 — Ack fast, work async
`billing.post('/webhook')` restructured into 3 phases:
1. **Verify signature** (`constructEvent`) — isolated try/catch.
2. **Claim idempotency on `event.id`** — durable: insert `stripe_processed_events` row
   `{status:'pending', payload:<raw event>}` BEFORE acking. Duplicate/racing delivery →
   idempotency short-circuit `200 {duplicate:true}`.
3. **Respond `200` immediately**, then `void processStripeEvent(event)` (background
   continuation). Side-effects no longer block the ACK.

**Mechanism justification (smallest reliable):** rather than a new job table, the existing
`stripe_processed_events` idempotency table is extended into a durable job log
(`status/payload/attempts/last_error/updated_at`, migration `0084`). Fire-and-forget is safe
on Railway (process stays alive); the durability gap (process restart between ACK and
completion) is closed by `recoverStuckWebhookJobs()` replaying `failed` + stale-`pending`
jobs from the **stored payload** — no reliance on Stripe retries (which won't happen after a
200). Handlers converge entitlement to the event's truth and the row status gates
re-application, so replay is idempotent.

### WH2 — Per-call timeouts
New `lib/with-timeout.ts` (`withTimeout`, `TimeoutError`, `envTimeoutMs`). Applied to:
- pre-ACK idempotency check + claim insert — `STRIPE_WEBHOOK_CLAIM_TIMEOUT_MS` (5s default),
- `stripe.subscriptions.retrieve` — `STRIPE_WEBHOOK_STRIPE_TIMEOUT_MS` (10s),
- each business handler — `STRIPE_WEBHOOK_HANDLER_TIMEOUT_MS` (20s),
- `markJobDone`/`markJobFailed` Supabase writes — `STRIPE_WEBHOOK_SUPABASE_TIMEOUT_MS` (8s).

All env-overridable. Timeout → the job is marked `failed` (releasable), never a poison-pill.
Structured error logging carries `event_id`/`event_type`/`timeout`/`error_class` context.

### WH3 — Honest error surfaces
`400 "Invalid signature"` is now returned **only** by the signature-verify catch. Error
classes are distinct in both code and logs:
- signature failure → `400` (`error_class:'signature'`),
- pre-ACK claim/infra failure (Supabase unreachable before we acked) → `500` (`error_class:'infra'`) so Stripe retries — **never** a 400,
- post-ACK business/processing failure → logged-async error (`error_class:'processing'`) +
  job row `status='failed'` releasable (the 200 was already sent per WH1). Never a 400.

### WH4 — External uptime ping
`GET /health` verified 200 (runtime-checked this sprint). External monitor is a
**founder-todo** (account creation needs founder credentials) — exact UptimeRobot steps in
`_sprint/webhook/UPTIMEROBOT_SETUP.md` (5-min interval, point at prod `/health` root, not
`/deep`).

## Recovery sweep wiring
`lib/cron.ts` runs `recoverStuckWebhookJobs()` every 5 minutes (gated on `ENABLE_CRON=true`).

## Gates — synthetic Stripe TEST events (unit/integration)
`apps/api/src/routes/billing-webhook.test.ts` (6) + `services/stripe-webhook-processor.test.ts` (5):
- ✅ valid event → **200 in <500ms**, side-effects kicked async, payload claimed `pending`
- ✅ duplicate delivery (already claimed) → idempotency no-op, processor NOT re-invoked
- ✅ concurrent duplicate (unique-pk conflict) → no-op, no double-process
- ✅ real signature failure → `400 "Invalid signature"`, no claim, no processing
- ✅ forced Supabase stall (claim phase) → **timeout → 500, NEVER 400**, nothing claimed
- ✅ handler throws → job `failed` (releasable), processStripeEvent NEVER rejects
- ✅ handler STALLS → per-call timeout → job `failed`, no hang
- ✅ recovery replays a `failed` job from stored payload → `done`; a payload-less row is
  skipped (not fabricated)
- ✅ WH4 `/health` → 200 `{status:'ok'}`

**Full suite: 449 passed / 16 skipped. tsc: clean.** Evidence in `evidence/webhook-hardening/`.

## Consumption ledger
No entry required — pure infra plumbing, no new AI consumption or paid service (UptimeRobot
free tier = $0 COGS). Existing money/token accounting untouched.

## LIVE GATE — REQUIRED BEFORE MERGE (HALT)
Synthetic TEST events are green, but the prompt requires a real founder-driven live gate.
**Founder must do ONE of:**
- **(A) Branch preview:** deploy this branch to a preview, point a Stripe **test-mode**
  webhook endpoint at `<preview>/api/billing/webhook`, then run one real upgrade flow on the
  test account → confirm the plan flips correctly and the Stripe webhook delivery log is
  clean (200s, no timeouts), OR
- **(B) Local:** run the API locally with `stripe listen --forward-to
  localhost:3001/api/billing/webhook` (test mode), perform one upgrade on the test account →
  same confirmation.

Also before/at merge: ensure **`ENABLE_CRON=true`** on the API service (else the recovery
sweep doesn't run) and apply migration `0084` via the normal migration path (authored, not
applied here).

**Status: HALT — awaiting founder live gate + merge grant. Do not merge until green.**

## Honest limitations
- Live gate not performed by CC (requires founder Stripe test-mode action) — see above.
- External uptime monitor is founder-todo (no account created).
- Recovery sweep depends on `ENABLE_CRON=true`; if unset in prod, failed jobs won't
  auto-replay (they remain visible in the table for manual reprocessing). Flagged above.
- `withTimeout` bounds the *await*, it does not *cancel* the underlying Stripe/Supabase
  call; a timed-out write may still land server-side. Safe here because replay is
  idempotent (row status + entitlement convergence).
- Migration `0084` authored, NOT applied (cloud rule).

## Founder action list
1. Run the live gate (A or B above) on the test account; confirm plan flip + clean webhook log.
2. Set `ENABLE_CRON=true` on the API service if not already.
3. Apply migration `0084_stripe_webhook_jobs.sql`.
4. Create the UptimeRobot monitor (`_sprint/webhook/UPTIMEROBOT_SETUP.md`).
5. Grant merge (paste + live gate green) → then rebase/merge `--no-ff`, verify prod
   `/api/version` + Stripe dashboard deliveries + `/health` 200.
