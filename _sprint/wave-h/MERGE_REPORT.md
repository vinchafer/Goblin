# WAVE-H — Performance & Skalierung — MERGE REPORT

**Branch:** `claude/wave-h-cr9hpz` (from the accumulated chain: master + Waves B/C/E/F merged).
**Runbook 4 · the LAST wave of the chain — it measures the finished system.**
**Merge:** founder-granted (PR + HALT). No merge performed by CC.

## Context recap (3 lines)
Everything before this wave was verified for one user. Wave H hardens the single-box platform
for many concurrent users and closes the Code-DD's N-findings (`run-registry.ts:86` single
box, no admission control, unbounded concurrent runs) plus observability ticket #12 and SSE
ticket #15. Measurement-driven: no optimization ships without a before-number, and no new paid
infra ships without a founder decision-table.

## Per-unit table

| Unit | Commit | What | Gate evidence | Status |
|------|--------|------|---------------|--------|
| **H1** Baseline & load harness | `fdf9e00` | Synthetic in-process load harness driving N concurrent runs through the F-40 registry (mocked execute); read-only `admissionSnapshot()` seam; BASELINE.md | `_sprint/wave-h/BASELINE.md` + `evidence/baseline-n{200,1000}.json`: peakInFlight tracks N to 2000, 0 rejected → N-6 confirmed. Harness re-runnable. | ✅ before-numbers captured |
| **H2** Caching | `9cd2779` | Version endpoint stable-per-boot + `Cache-Control: public, max-age=30`; **no** speculative in-process caching (H1 showed the registry isn't the hotspot); Redis shared-cache decision-table + HALT | `version-handler.test.ts` 3/3 (header present, body byte-stable, both mounts identical); `H2_CACHING.md` decision table | ✅ + HALT (Redis founder-gated) |
| **H3** Streaming hygiene (#15) | `ff57890` | Measured current F-40 stream behavior under concurrency; symmetric teardown on the chat SSE path | `streaming-hygiene.test.ts` 4/4: 0 leaked subscribers on completion, disconnect (run continues), N=25 concurrent, slow-client no-starve | ✅ #15 closed with evidence |
| **H4** Concurrency & queueing (N-1/N-6) | `4eaab16` | Atomic global + per-user concurrent-run cap in `startRun`; honest DE+EN "auf Anschlag" 429 + bounded client auto-retry; env-tunable generous defaults | `admission.test.ts` 5/5 + `capacity-copy.test.ts` 2/2 + `agent-capacity.test.ts` 4/4; harness after: peakInFlight 1000→50, 0 leaks | ✅ N-1/N-6 closed |
| **H5** Observability (#12) | `af3416c` | Per-request correlation IDs (logs + Sentry + `x-request-id`); in-process metrics registry with derived alerts; `GET /api/admin/metrics` | `metrics.test.ts` 7/7 + `admin-metrics.test.ts` 3/3: a synthetic error-spike / OPEN breaker / capacity-shedding all visible in one GET | ✅ #12 closed |
| **H6** DB & storage under scale | `33441aa` | Index audit (12 hot paths); migration 0097 for the F5 prune-cron scan gap (authored, NOT applied); hydrate N+1 → bounded-parallel | `INDEX_AUDIT.md`; `0097_checkpoint_prune_index.sql`; agent suite 159/159; tsc clean | ✅ (timings founder-run) |

## Before / after (H1 harness — the measurement-driven gate)

| Scenario (N=1000, workMs=300) | peakInFlight | rejected | heap Δ | leaked subs |
|-------------------------------|--------------|----------|--------|-------------|
| **BEFORE** (no caps — today's code) | **1000** | 0 | 11.3 MB | 0 |
| **AFTER** (global=50, per-user=2) | **50** | 950 (all honest `global_limit`) | ~0 MB | 0 |

The unbounded in-flight count the Code-DD flagged (N-1/N-6) is now a hard `min(N, cap)`, and
the honest "auf Anschlag" copy replaces what would otherwise become a pool-exhaustion / shared-
breaker node outage. At N=2000 the same holds (peakInFlight 2000→50). The caps ship at
**generous defaults so no real user is throttled at current scale** (LIVE USERS); the founder
tunes or disables via env.

## Self-review checklist (§3 — explicit)
1. **Evidence audit** — every artifact re-opened: harness JSONs show peakInFlight/leaked as
   claimed; all gate tests re-run green (see numeric figures below). ✅
2. **Diffstat vs scope** — 29 files, all justified by a unit (`git diff --stat fdf9e00^..HEAD`);
   consumption path (H4 concurrency cap) listed in the ledger. No drive-by edits. ✅
3. **Regression** — full API suite 978 → **1002** tests green (nothing broke on untouched
   paths); F-40 registry 9/9 and agent suite 159/159 still green after the admission change. ✅
4. **Honesty sweep** — new user strings are the capacity copy (DE+EN, tested): no unverifiable
   claim, no English leak in DE (and vice-versa), no fabricated state; "dein Lauf startet in
   Kürze" is made truthful by the client auto-retry (the run is deferred, not lost). ✅
5. **Ledger** — H4 adds a COGS-bounding note (caps peak simultaneous M10 completions); H2/H6
   change no token path; H1/H3/H5 are zero-token. Row present in the H4 commit. ✅
6. **Report completeness** — per-unit commit SHAs, evidence refs, Honest-Limitations (below),
   founder actions, numeric pass rates — all present. ✅
7. **The Steven question** — a skeptic with only this evidence would reach the same verdict for
   the in-sandbox claims; every claim that needs live infra (endpoint p50/p95, DB timings,
   real-load breaking point) is explicitly marked UNVERIFIED / founder-run, not asserted. ✅

## Numeric acceptance figures
- Full API suite: **1002/1002** (120 files). API tsc **clean**; web tsc **clean**; web build **clean**.
- Wave-H gate tests: H1 harness (re-runnable, JSON captured) · H2 3/3 · H3 4/4 · H4 5+2+4/11 ·
  H5 7+3/10 · H6 covered by agent suite 159/159 + audit.
- Money suites: **unchanged** — they self-skip without `sk_test_` (this wave touches no money
  path), so they stay 17/17 when the founder/CI runs them with the test key.
- Before/after: peakInFlight 1000→50 (N=1000), 2000→50 (N=2000); heap 11.3→~0 MB; 0 subscriber
  leaks in every scenario.

## Honest limitations (mandatory)
1. **The load harness is in-process synthetic, not HTTP-over-the-wire.** It proves the
   admission / registry / subscriber behaviour the N-findings name; it does **not** measure DB
   pool, real model latency, or the circuit-breaker interaction. HTTP endpoint p50/p95 (chat
   send, file list, publish) is a documented **founder-run autocannon recipe** (BASELINE.md),
   **UNVERIFIED here**. The "real first breaking point" (upstream LLM + shared breaker) is
   reasoned from the DD, not measured.
2. **H6 before/after timings are founder-run.** No populated Postgres in the sandbox → the
   round-trip/scan-count improvement is deterministic, the millisecond win needs
   `EXPLAIN ANALYZE` (recipe in INDEX_AUDIT.md). Migration 0097 authored, **NOT applied**.
3. **All new limits/metrics are in-process/per-instance** (reset on deploy), exactly like the
   existing WAVE-D caps. On the single Railway box that IS the whole fleet, so the numbers are
   complete — but a cross-replica admission store / shared cache / shared breaker (N-1/N-2/N-3/
   N-4) remains a **founder-gated paid-infra decision** (H2 decision table), deliberately NOT
   built. On scale-out, the per-instance caps multiply by replica count.
4. **The H4 late-admission race backstop** can, in the microsecond window between the early
   pre-check and the atomic reservation, leave a `status='running'` agent_runs row with no
   events; it is reaped by the existing staleness filter (documented in code). Vanishingly rare
   (two same-user requests in the same tick).
5. **The web capacity auto-retry** (bounded, 3×) is unit-tested at the helper level
   (`agent-capacity.test.ts`); the full hook retry loop is exercised by types + the helper
   tests, not an integration test (the web has no hook-test harness in CI).

## Founder actions
1. **Apply migration 0097** (`supabase/migrations/0097_checkpoint_prune_index.sql`) via the
   Supabase SQL editor when convenient — pure perf win, pre-index tolerant, no behaviour change.
2. **Tune the concurrency knobs if desired** (all optional, generous defaults in place):
   `AGENT_GLOBAL_MAX_CONCURRENT` (50), `AGENT_MAX_CONCURRENT_PER_USER` (2),
   `AGENT_CAPACITY_RETRY_AFTER_SEC` (8). Set the global to `0` to disable entirely.
3. **Verify one metric is visible:** `curl -H "x-admin-key: $ADMIN_API_KEY"
   https://<api>/api/admin/metrics` → expect the JSON snapshot (in-flight runs, error-rate
   window, agent success rate, circuit states, alerts).
4. **Verify one normal agent run is unregressed on prod:** run a small build on the test
   account (`vinc.hafner3@`) and confirm it streams + completes as before (the caps are far
   above single-user load, so it should be byte-identical to today).
5. **Optional, founder-run:** the BASELINE.md autocannon recipe against a LOCAL build for real
   endpoint p50/p95, and the INDEX_AUDIT.md `EXPLAIN ANALYZE` before/after for 0097.
6. **Decide (or defer) the shared-cache/registry question** (H2_CACHING.md decision table) —
   only when horizontal scale-out is actually planned; it is not today (single-box deploy).

## Decisions escalated (not taken by CC)
- **Shared cache (Redis/Upstash) for cross-replica plan/entitlement (N-4)** — new paid infra →
  decision table in H2_CACHING.md, **HALT**.
- **Cross-replica admission store / shared circuit breaker (N-1/N-3)** — same class; the
  in-process caps are the single-box fix, the durable cross-replica store is founder-gated.
