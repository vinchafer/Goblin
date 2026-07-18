# WAVE-G — PARKED (founder decision, 2026-07-18)

**Status: PARKED — do not build.** The spike (`_sprint/wave-g/SPIKE.md`) and its A-3
correction stay banked on branch `claude/wave-g-74prft`. No PR beyond this note.

## Founder rationale (recorded verbatim in intent)
1. **Execution compute is platform COGS in the free flow.** Test *execution* (D-G3) is a
   platform-COGS cost with no revenue behind it in the free tier — the wrong thing to stand
   up unbacked.
2. **The runner is Act-II Keeper infrastructure.** The sandboxed runner D-G1 would build
   (headless checks against deployed apps) is really Keeper (Act II) infra. It will be built
   **once, there, revenue-backed** — not stood up early for Wave G and then rebuilt.
3. **Test value materializes with complex apps.** The payoff of generated behavior tests
   appears when apps get complex — which the **first cohort must first demonstrate**. Until
   that demand is real, the value isn't there to justify the COGS + isolation-hardening.

## What stays banked (do not discard)
- **`SPIKE.md`** — the D-G1/D-G2/D-G3 decision tables + recommendations, reusable when the
  Keeper runner is built.
- **The A-3 correction** — the state-first finding that "runtime-smoke infra (A-3, shipped)"
  is **false**: A-3 was HALTed; only `verifyDeployment()` (fetch-based, no JS execution)
  ships, and **no server-side environment executes generated code today**. This correction
  is the durable value of the session and must inform whoever builds the Keeper runner:
  D-G1 is a **build**, not a reuse.

## When Wave G is unparked
Re-open `SPIKE.md`, re-run Phase 0 state-first (the repo will have moved), and fold D-G1
into the Keeper runner rather than as a standalone service. The billing recommendation
(execution = platform COGS, generation = user allowance, new M16 row, per-user execution
cap) holds, but the COGS is only justified once revenue backs it and complex-app demand is
demonstrated.

**HALT.**
