# WAVE-H · H2 — Caching (where H1 says it pays)

The H2 rule is measurement-driven: **no optimization without a before-number.** So H2 is
scoped by what H1 actually measured, not by where caching *might* help.

## What H1 said

H1's baseline measured the process-level run registry / admission path under N concurrent
runs. The finding (BASELINE.md): the registry is **NOT the bottleneck** — its own bookkeeping
stays cheap (complete p50 204→384 ms as N goes 200→2000), and the real first breaking point
is **upstream** (the LLM + the shared circuit breaker, then Supabase). H1 did **not** surface
an in-process CPU hotspot that a cache would remove. The Code-DD agrees: the hot caches that
exist (`cache.ts`, breaker, rate-limit) are already in-process; the scale pain is
cross-replica staleness (N-4), not a missing local cache.

**Therefore H2 does NOT ship speculative in-process caching.** Wiring the (currently unused)
`cache.ts` TTL layer onto plan/entitlement/model reads without a before-number would be
optimization-on-a-hunch — and worse, it would risk serving a real user a **stale plan** for
up to the TTL, an honesty/correctness cost with no measured latency benefit to justify it.
That is exactly the anti-pattern the methodology forbids.

## What H2 does ship (safe, verified, no new service)

**Static Cache-Control on the public version endpoint** (`lib/version-handler.ts`). The
"static/CDN headers" candidate from the unit spec, and the one caching win that is (a) safe
(the payload is not user-specific and changes only on deploy), (b) real under many clients
(clients poll `/api/version` for new-deploy detection), and (c) verifiable in-sandbox.

Before → after:

| | before | after |
|--|--------|-------|
| `buildTime` | `new Date()` **per request** → body changes every call → **uncacheable** | `BOOT_TIME` captured once at module load → **byte-stable per boot** |
| `Cache-Control` | none | `public, max-age=30` |
| honesty | `buildTime` was actually the *response* time, not a build time | `buildTime` is the process boot time |

Gate: `version-handler.test.ts` (3) — header present, body stable across calls (does not
advance to "now"), both mount points identical. This is header-level verification (a route
test), not an H1-harness latency number — the honest note is that the *edge/browser* win
(fewer round trips under many clients) is real but its magnitude is a CDN-hit-rate metric,
not something the in-process harness measures.

We deliberately did **not** add Cache-Control to authenticated per-user responses (`/api/*`
with a Bearer token — e.g. the models catalog): those are per-user and must never land in a
shared CDN cache. The models catalog keeps its existing in-process `creditsCache`.

## The caching that WOULD pay at scale — and why it HALTs here

The Code-DD's N-4 names the real scale-caching gap: the in-process `cache.ts` means
plan/entitlement can be **stale up to 5 min cross-replica** after a change, and
`cacheDelPattern` is local-only, so an invalidation on one replica doesn't reach the others.
The fix is a **shared cache** (or pub/sub invalidation) — which is **new paid infrastructure**,
and CLOUD RIDER + the escalation table forbid adopting it without a founder decision. So it is
tabled here, not built:

### Decision table — shared cache for cross-replica plan/entitlement (N-4)

| Option | New paid service? | Cross-replica correct? | Effort | Fit / risk |
|--------|-------------------|------------------------|--------|------------|
| **A. Status quo** (in-process TTL, 5 min) | No | No — stale ≤5 min after a plan change; only bites on scale-out (≥2 replicas) | 0 | Fine on the single box (today's deploy); the DD's N-4 is "@scale-out", not now |
| **B. Redis / Upstash shared cache + pub/sub invalidation** | **YES** (Upstash was explicitly removed in 11A-4 as never-configured) | Yes | days | Correct fix, but a new dependency, a new cost line, and a new failure mode — founder-gated |
| **C. Drop TTL to near-0 for entitlement, read-through on each request** | No | Yes (no stale window) | hours | More DB reads per request (bounded by existing `USER_PLAN` usage); a middle option if scale-out lands before Redis |

**Recommendation (not a decision):** stay on **A** until horizontal scale-out is actually on
the table (it is not — the deploy is single-box, `railway.json` has no `numReplicas`). When
scale-out is planned, revisit **B vs C** with the founder. **HALT — this is a founder call
(money + new dependency + scale-out timing), not CC's to make.**

## Honest limitations (this unit)

1. The version-endpoint win is verified at the **header level** (a route test), not as an
   H1-harness latency delta — the CDN/browser round-trip reduction is real but its size is a
   deployment (CDN-hit-rate) metric, UNVERIFIED here.
2. No in-process caching was added, by design (no before-number → no optimization). The
   `cache.ts` TTL layer remains available but unwired for plan/entitlement, awaiting the
   shared-cache decision above.
3. The DeepInfra prompt-prefix cache (Wave A-1 / D-G) already covers the agent/chat static
   prefix; H2 adds nothing there — it is provider-side and cache-warm, not an H2 lever.
