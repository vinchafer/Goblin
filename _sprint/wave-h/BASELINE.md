# WAVE-H · H1 — Baseline & Load Harness

**Measurement-first, no fixes.** This unit ships a repeatable synthetic load harness and the
*before* numbers the rest of Wave H is graded against. No optimisation lands in this commit.

## What the harness is (and deliberately is not)

CLOUD RIDER binds this wave: **load tests never run against prod under real users.** A full
HTTP load test needs a booted stack (Supabase + object storage + a real or mocked model). In
this sandbox that stack is not available, so the harness measures the exact DD surface the
Code-DD's N-findings name and nothing it cannot honestly reach:

- **In scope (measured here, deterministic, in-process):** the process-level run registry
  (`apps/api/src/services/agent/run-registry.ts:86`) — the `new Map()` that the N-findings
  call the single-box store — driven through `startRun` (the same entrypoint the agent route
  uses) with a **mocked execute** (no model call, no tokens, no network). Each run also
  attaches a real `streamRunEvents` sink, so SSE subscriber lifecycle is exercised (feeds H3).
- **Out of scope here (needs the booted stack → founder-run, recipe below):** endpoint-level
  p50/p95 over HTTP (chat send, file list, publish), real DB pool behaviour, and the upstream
  model/circuit-breaker interaction. Those are the *real* first breaking point (see below);
  the in-process harness cannot reach them without the full stack, and this file says so
  rather than inventing numbers.

Run:
```
LOG_LEVEL=silent npx tsx _sprint/wave-h/harness/load-harness.ts --n 200 --work 200 --users 50
# flags: --n concurrency  --work ms-per-run  --users distinct-users  --ramp ms-between-starts  --json
# env caps (applied after H4): AGENT_GLOBAL_MAX_CONCURRENT, AGENT_MAX_CONCURRENT_PER_USER
```

## Baseline numbers (BEFORE — registry as of this commit, no admission control)

Captured JSON: `_sprint/wave-h/evidence/baseline-n200.json`, `baseline-n1000.json`.

| concurrency (N) | workMs | admitted | rejected | **peakInFlight** | complete p50 | complete p95 | heapΔ | leakedSubs |
|-----------------|--------|----------|----------|------------------|--------------|--------------|-------|------------|
| 200             | 200    | 200      | **0**    | **200**          | 204 ms       | 205 ms       | ~0 MB | 0          |
| 500             | 300    | 500      | **0**    | **500**          | 316 ms       | 321 ms       | 4.4 MB| 0          |
| 1000            | 300    | 1000     | **0**    | **1000**         | 337 ms       | 355 ms       | 11.9 MB| 0         |
| 2000            | 300    | 2000     | **0**    | **2000**         | 384 ms       | 392 ms       | 13.6 MB| 0         |

### What the before-numbers prove

1. **N-6 / N-1 confirmed, concretely: there is no global admission control.** `peakInFlight`
   tracks `N` one-for-one all the way to 2000 concurrent runs; `rejected` is always `0`. The
   registry admits every run unconditionally — exactly the "no `p-limit`/`semaphore`" negative
   grep the Code-DD reported at `run-registry.ts:86`. This is the number H4 must change.
2. **In-flight is unbounded → heap is unbounded (N-1).** Heap delta grows with concurrency
   (~0 → 13.6 MB) even with a *trivial* mocked execute. In production each in-flight handle
   also holds an event ring (≤5000), mirrored project files, and a live model connection, so
   the real per-run cost is far higher — an unbounded map is an unbounded memory liability.
3. **Latency degrades gracefully in the synthetic path** (complete p50 204 → 384 ms as N goes
   200 → 2000): the registry's own bookkeeping is cheap. This is the honest counterpoint — the
   registry is *not* itself the bottleneck; the danger is that it imposes **no ceiling**, so
   the first thing to break is upstream (below), not the map.
4. **No subscriber leak at baseline** (`leakedSubscribers=0`, `liveHandlesAfterDrain=0` after
   every N): the F-40 stream teardown already returns subscribers to zero. H3 measures this
   under adversarial disconnect; the happy-path baseline is clean.

## The real first breaking point (honest, from the DD — NOT measured in-sandbox)

The synthetic harness does not crash at 2000 because it does no real work. The Code-DD (§5,
N-6) locates the true first breaking point **upstream of the registry**, and this harness
cannot exercise it without a live model/DB:

1. **Upstream LLM + the shared circuit breaker** — ~100 concurrent real runs 429 the provider;
   3 failures OPEN the single in-process breaker (`circuit-breaker.ts:13` `failureThreshold:3`)
   and reject *every* node run's calls to that provider — throttling becomes a full-node outage.
2. **Supabase single shared client + per-event insert storm** (`run-registry.ts:130`
   fire-and-forget insert per emitted event × N runs).
3. **Heap / event-loop pressure** from N event rings + mirrored files + the 120 s eviction grace.

H4 (global + per-user admission cap) is the direct closer for (1) and (3): a bounded in-flight
count bounds concurrent provider calls and bounded heap. (2) is an N-2/N-3 shared-store concern
that remains a founder-gated infra decision (no new paid service in this wave).

## Founder-run endpoint harness (autocannon recipe — needs the booted local stack)

For the HTTP-level p50/p95 the sandbox can't produce, boot the local stack per
`OPUS_OPERATING_SYSTEM.md §1.7` (api :3001 `GOBLIN_DEV_MODE=false`, web :3100, test-account
auth cookie) and run autocannon against the **local** build (never prod):

```bash
npx autocannon -c 50 -d 20 -m GET  \
  -H "Cookie: <test-account-cookie>" http://localhost:3001/api/code-sessions/<id>/files
npx autocannon -c 20 -d 20 -m POST -H "Content-Type: application/json" \
  -H "Cookie: <test-account-cookie>" \
  -b '{"prompt":"sag hallo"}' http://localhost:3001/api/chat-sessions/<id>/messages
# publish path: drive one agent run with confirmPublish against a throwaway project.
```
Record p50/p95/p99 + non-2xx count per endpoint. These belong in the founder-action list; they
are **UNVERIFIED in this wave** (declared, not claimed).

## Honest limitations (this unit)

1. The harness is **in-process synthetic**, not HTTP-over-the-wire. It proves the admission /
   registry / subscriber behaviour the N-findings name; it does **not** measure DB pool, real
   model latency, or the circuit-breaker interaction. Those are the founder-run autocannon rows
   above, explicitly UNVERIFIED here.
2. `heapDelta` is a coarse `process.memoryUsage().heapUsed` delta with GC running underneath, so
   small negatives appear (n200 = −0.2 MB); read the *trend* across N, not the absolute at one N.
3. The mocked execute holds its slot with `setTimeout`, not real CPU/IO, so the harness
   understates real per-run cost — it is a *floor* on the concurrency problem, not the ceiling.
