# WAVE-I — Founder-Funnel & Verhaltens-Messung — REPORT

**Branch:** `claude/wave-i-insight-vy36w0` · **Base:** `master` (`8b1259a`) · **Date:** 2026-07-10
**Standing:** All four units landed, gated, evidenced. Conditional merge is **founder-granted** — this report HALTs before merge.

The gap this closes: all telemetry so far measured TOKENS. Nothing measured BEHAVIOUR — where testers get stuck and silently quit. WAVE-I makes that visible before the first WhatsApp invite. **Privacy law of the wave: events carry METADATA ONLY — which function, when — never message content, file contents, or generated code.**

---

## Phase 0 — state-first findings (repo trusted over prompt)

- Branch `claude/wave-i-insight-vy36w0` already checked out; base is `master` at `8b1259a`.
- `platform_events` (migration **0078**) exists with an `event_type` **CHECK constraint** limiting it to `platform_cogs` / `context_retry`. **Consequence:** every funnel insert would violate the CHECK and silent-fail → a new migration (0085) is REQUIRED to persist behaviour events. (The prompt called 0078 "applied"; application state is a runtime DB fact the repo can't confirm — the emitter is pre-migration-tolerant either way, so this is not a blocker. Flagged for the founder below.)
- `platform_events.user_id` has **no FK** to `auth.users` → it does NOT cascade on account deletion and must be purged explicitly (drove I3).
- Admin auth = layout gate (`is_admin`/`ADMIN_EMAIL`) → web `/api/admin` proxy re-checks `isAdmin()` (403) + injects `x-admin-key` → backend `x-admin-key` middleware. Reused as-is (Wave-D discipline, API-side).
- Resend (`lib/email`) + in-process cron (`lib/cron`) both exist → the optional digest (I4) needs **no new service**.

---

## Units (one unit = one revertable commit)

| Unit | Commit | What |
|---|---|---|
| I1 | `8eb4545` | Behaviour-funnel event instrumentation |
| I2 | `cf7dcc9` | Founder dashboard `/admin/insight` |
| I3 | `f48f177` | Events join the purge + honest Datenschutz copy |
| I4 | `cab0bdf` | Optional daily founder digest |
| ledger | (this commit) | Consumption-ledger NOTE (zero-token) |

### I1 — Event instrumentation
Server-side emits at each **truth-gate** (never a client claim):
`onboarding_completed`, `project_created`, `message_sent` (project + standalone), `agent_run_finished` (incl. failed runs — hiding them would inflate success), `publish_verified` / `publish_failed` (from the deploy truth-gate, failing check in meta), `upgrade_clicked` (checkout) + `upgraded` (Stripe webhook), `login` (actives). **`signup` is derived from `users.created_at`** — more reliable than an event.
- `platform-events.ts`: broadened `PlatformEventType`; added fire-and-forget `trackEvent()` (never awaited, never throws → never blocks/slows UX).
- **`POST /api/events`**: the ONLY client-emittable path — whitelist (`trial_card_shown/clicked`, `help_opened`, `feedback_submitted`), auth-gated, metadata-only guard (long/nested values rejected). A client **cannot forge** a truth-gated funnel event.
- Web: `emitEvent()` helper; wired trial-card shown/clicked + help_opened.
- Migration **0085** (authored, NOT applied): drops the closed CHECK, adds funnel/journeys indexes.

**Gates:** per-event mapping test · scripted canonical-journey **sequence** test · **privacy payload audit** (no content field in any column/meta) · ingest whitelist + **no-forge** + **no-content** tests. `apps/api/src/lib/funnel-journey.test.ts`, `routes/events.test.ts`.

### I2 — Founder dashboard `/admin/insight`
Reads `platform_events` + `users` ONLY (no third-party analytics). One read serves all three views; in-memory reduce (tester scale).
- **Funnel (7/30 d):** signup cohort → each stage = first occurrence of its event; conversion vs signup + step drop-off.
- **Journeys:** furthest stage, last event, **"stuck ≥24 h"** (quiet ≥24 h AND not yet at a live app); stuck sorted first; **test accounts tagged, toggleable**.
- **Pulse:** daily actives, agent-run success %, publish success %, feedback count.
- Test-account filter in **every** view via `includeTest` (`INSIGHT_TEST_EMAILS` / `ADMIN_EMAIL` / `TEST_ACCOUNT_EMAIL`).
- `GET /api/admin/insight` gated by existing `x-admin-key`; non-founder → **403** at the web proxy (API-verified). Mobile-first, dark+light.

**Gates:** insight-math unit test (counts/conversion, stuck flag, pulse rates, test filter) — `services/insight.test.ts`. **Numbers cross-check** (seeded): 9 signups → 2 reached a live app (22.2 %), 4 stuck; filter 9→10 with the test account included. **375 px dark+light render** captured. Evidence: `evidence/wave-i-insight/`.

### I3 — Privacy & purge completeness
- `hardDeleteUser` deletes `platform_events` by `user_id` in the explicit cascade-gap cleanup (no FK → no cascade). Pre-migration tolerant — a missing table can never BLOCK a deletion; any other error stops the purge like `build_runs` (GDPR Art. 17: never silently skip existing PII).
- Datenschutz: honest usage-events paragraph, **DE + EN** — "Wir erfassen Nutzungsereignisse — welche Funktion wann — nie Inhalte", retained only while the account exists, erased on deletion.

**Gates:** purge test (victim erased, bystander untouched) — runs Stripe-independently here + asserted in the canonical full-purge PROOF 4. Payload audit as in I1. `services/account-deletion-events-purge.test.ts`.

### I4 — Stuck-user visibility + optional digest
Stuck visibility ships in the I2 Journeys view. The digest is the OPTIONAL loop-closer, built on existing Resend + cron (no new service):
- `buildDigest()` → 7 d headline + stuck list + pulse, metadata only. `sendFounderDigest()` = strict opt-in no-op (`GOBLIN_FOUNDER_DIGEST=true` + recipient), never throws. Cron tick daily 07:00 UTC, self-gates on the env.
- **OFF by default.** No unsolicited email was sent from this session (no `RESEND_API_KEY` here, and sending is outward-facing). The rendered digest with correct seeded numbers is the evidence; the first real send is founder-enabled.

**Gates:** builder test (headline numbers match payload, every stuck user listed, subject, privacy footer) + opt-in no-op tests. Evidence: `evidence/wave-i-insight/founder-digest.{html,png}`.

---

## HARD RULES compliance
- **Zero token consumption** — metadata only, fire-and-forget; no model call, no `completion_costs` row, no billing-math change. **Ledger NOTE added, no M-row** (per standing rule; stated explicitly).
- **Events never block/slow flows** — `trackEvent` is fire-and-forget + silent-fail; tested under table-absent failure.
- **Test-account traffic filterable in every view** — `includeTest` across funnel, journeys, pulse; digest excludes test accounts.
- **No new paid services** — reuses Supabase / Resend / cron only.
- **Migrations authored, NOT applied** — 0085 (founder applies).
- **DE UI + EN i18n**, no false claims.

## Test status
`apps/api`: **470 passed / 16 skipped** (the 16 skips are pre-existing Stripe-key-gated suites). API `tsc --noEmit` clean; web `tsc` clean.

## Honest limitations
1. **Migration 0085 must be applied** by the founder before ANY behaviour is recorded (until then every funnel insert silent-fails — by design, no crash). Same for 0078 if it was never actually applied.
2. **`agent_run_finished` has no `run_started` twin** — Pulse reports runs *finished* + success rate, not started. Adding "started" is a follow-up if the founder wants funnel-within-a-run.
3. **`feedback_submitted` is whitelisted but not yet wired** — there is no feedback-submit UI in the app today; the ingest path is ready for when one exists.
4. **`login` resolves the user by email** on the public login-attempt endpoint (best-effort, success-only, fire-and-forget). Users who log in via a path that doesn't hit that endpoint won't emit `login`; daily-actives still counts them via any other event.
5. **The digest's first real send is founder-side** — built, tested, rendered with correct numbers, but not sent from this session (opt-in + no key).
6. **The client tracking opt-out (settings) governs client analytics, not these first-party operational events** — the events are disclosed usage metadata, purged on deletion. Flagging for the founder in case a stricter stance is wanted.
7. **`next build` could not fully prerender in this sandbox** — it failed on the unrelated `/demo-preview` page for missing `NEXT_PUBLIC_SUPABASE_*` env (a pre-existing, env-only condition; Vercel has these). My code **compiled + typechecked clean**; no page I touched is in the failing path.

## Founder action list
1. **Apply migration `0085_platform_events_funnel.sql`** (Supabase SQL Editor) — and confirm `0078` is applied. Until then, insight shows empty (no crash).
2. **Verify the funnel on prod** with one real mini-journey on the test account → it should appear in `/admin/insight`; confirm a non-admin request → 403.
3. Optionally set `INSIGHT_TEST_EMAILS` (defaults fold in `ADMIN_EMAIL` / `TEST_ACCOUNT_EMAIL`) so QA traffic is cleanly filterable.
4. Optionally enable the digest: `GOBLIN_FOUNDER_DIGEST=true` + `FOUNDER_DIGEST_EMAIL` (needs `RESEND_API_KEY`, `ENABLE_CRON=true`).

## Migration flags
- `supabase/migrations/0085_platform_events_funnel.sql` — **authored, NOT applied.**
