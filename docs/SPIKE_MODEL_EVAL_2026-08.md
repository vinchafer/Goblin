# SPIKE — Model evaluation: Goblin Swift + Goblin Forge candidates

**Date:** 2026-08-19 · **Type:** evidence-gathering spike · **Status:** COMPLETE, no production change
**Decision owner:** Vincent. This document does not switch anything and does not propose new caps.

> **What this is.** Two open-weight candidates appeared for Goblin's two own models. This spike
> measured all four models (2 current, 2 candidate) against the same 8 German probes on the same
> day, on the same provider account, with the same knobs, and wrote down what came back. It
> produces evidence and a recommendation. The switch itself, if any, is a separate session.
>
> **What was NOT touched:** no model ID, no routing config, no env var, no provider client, no
> cap, no weight, no pricing. `FORGE_WEIGHT` is still 4.4 and `GOBLIN_MONTHLY_ALLOWANCE` is
> untouched. See §Scope audit.

---

## 1. Phase 0 — what the repo actually configures today

Working tree was clean at `e4ed0f0` before any work began. The repo agrees with the brief on
every point; nothing contradicted it.

| Role | Goblin name | Provider slug as configured | Source of truth |
|---|---|---|---|
| Default / high volume | **Goblin Swift** | `deepseek-ai/DeepSeek-V3.2` | `apps/api/src/services/goblin-hosted.ts:54` (`DEFAULT_MODEL_EFFICIENT`) |
| Heavier tier | **Goblin Forge** | `moonshotai/Kimi-K2.6` | `apps/api/src/services/goblin-hosted.ts:55` (`DEFAULT_MODEL_PREMIUM`) |

Both are env-overridable (`GOBLIN_HOSTED_MODEL_EFFICIENT` / `GOBLIN_HOSTED_MODEL_PREMIUM`,
`goblin-hosted.ts:91,105`), so a slug change needs no code change. Supporting constants read but
not modified:

- `FORGE_WEIGHT = 4.4` — `apps/api/src/lib/goblin-cap.ts:48`
- `GOBLIN_MONTHLY_ALLOWANCE` (trial 4.9M / build 17.4M / pro 30M / power 61.7M cost units) — `goblin-cap.ts:55-66`
- `GOBLIN_MAX_TOKENS_PER_REQUEST = 8096` — `goblin-hosted.ts:179`
- Internal COGS basis: Swift `$0.147 in / $0.294 out`, Forge `$0.650 in / $1.300 out` per 1M — `apps/api/src/lib/model-pricing.ts:35-36`. Header records these as blended `$0.162` / `$0.715` at 9:1 with caching, and `4.4 = 0.715 / 0.162`.

**Resolved candidate IDs.** Taken from DeepInfra's live model list (`GET /models/list` and the
authenticated `GET /v1/openai/models`), never from memory. All four are present, none is flagged
`deprecated`, none has a `replaced_by`:

| | Slug | Created | Quantization |
|---|---|---|---|
| Swift, current | `deepseek-ai/DeepSeek-V3.2` | 2025-12-02 | fp4 |
| Swift, candidate | `deepseek-ai/DeepSeek-V4-Flash-0731` | 2026-07-31 | fp8 |
| Forge, current | `moonshotai/Kimi-K2.6` | 2026-04-21 | fp4 |
| Forge, candidate | `moonshotai/Kimi-K2.7-Code` | 2026-06-15 | fp4 |

No HALT condition fired: the tree was clean, all four models exist on DeepInfra, the existing
`DEEPINFRA_API_KEY` authorized fine, and spend stayed far under the ceiling.

---

## 2. Live DeepInfra price table

Read from the provider at run time and stored inside the raw results, so every `$` below traces
to a provider response rather than to a blog post. USD per 1M tokens.

| Model | Input | Output | Cached input | Served context | Explicit cache-write |
|---|---|---|---|---|---|
| `deepseek-ai/DeepSeek-V3.2` | **0.26** | **0.38** | 0.13 | 163,840 | NOT EXPOSED (null) |
| `deepseek-ai/DeepSeek-V4-Flash-0731` | **0.08** | **0.18** | 0.016 | **1,048,576** | NOT EXPOSED (null) |
| `moonshotai/Kimi-K2.6` | **0.75** | **3.50** | 0.15 | 262,144 | NOT EXPOSED (null) |
| `moonshotai/Kimi-K2.7-Code` | **0.68** | **3.40** | 0.136 | 262,144 | 1.25× (5m) / 2× (1h) input |

Notes on provenance:
- Input/output/cached figures are the `metadata.pricing` block of `GET /v1/openai/models`.
- The cache-write column comes from the internal `/models/list` field
  `rate_per_explicit_cache_write_token`. It is a multiplier on input price, and it is `null` for
  three of the four models — those are marked **NOT EXPOSED**, not filled in from elsewhere.
- **Discounts and any negotiated account-level rate are NOT EXPOSED by either endpoint**
  (`discount: null` on all four). If Goblin has committed-spend pricing, these are list prices and
  the founder must read the console — see §9.
- Cost arithmetic was validated against DeepInfra's own `estimated_cost` field on a control call
  and matched to the cent-fraction ($0.00000108 computed vs $0.00000108 reported).

---

## 3. Deterministic results — objective, no judgement

**Method.** 4 models × 8 probes × 3 repetitions = **96 calls**, all completed. Identical knobs for
all four: `temperature = 0.2`, `max_tokens = 8096` (production parity with
`GOBLIN_MAX_TOKENS_PER_REQUEST`), single user message, no system prompt, streamed. Checks use real
parsers — `parse5` for HTML, the TypeScript compiler's parser for JS/JSX — not regex.

A probe counts as PASS for a model when the **majority of its 3 runs** pass. Cells show `passes/runs`.

| Model | P1 | P2 | P3 | P4 | P5 | P6† | P7 | P8 | Rate | Rate (valid probes) |
|---|---|---|---|---|---|---|---|---|---|---|
| Swift current — V3.2 | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | **8/8** | **7/7** |
| Swift candidate — V4-Flash-0731 | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | **8/8** | **7/7** |
| Forge current — K2.6 | 2/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | **8/8** | **7/7** |
| Forge candidate — K2.7-Code | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 3/3 ✓ | 1/3 ✗ | 3/3 ✓ | 3/3 ✓ | **7/8** | **7/7** |

What each check actually asserted:
- **P1 / P2** — output parses as an HTML document, has `<body>`, an embedded `<style>`, an inline
  `<script>`, no external library reference, and the fields the prompt named (P1 ≥3 inputs for
  Datum/Distanz/Dauer; P2 ≥1 input plus a browser persistence API in the script).
- **P3** — the corrected code contains a `reduce(fn, initial)` call with two arguments, found by
  walking the AST. All four identified the missing accumulator, 12/12 runs.
- **P4** — `JSON.parse` of the raw text on the **first attempt**, exactly the keys
  `name, version, features`, `features` exactly three strings. No fence-stripping, no repair, no
  partial credit. All four, 12/12 runs.
- **All probes** — completed without truncation (`finish_reason`).

**Truncation:** exactly one call in 96 hit the 8096 ceiling — Kimi K2.6 on P1 run 3. Every other
call finished with `stop`. That single truncation is the only reason K2.6 scores 2/3 on P1.

**† P6 is VOID as a refactor probe — and this is the most interesting finding in the table.**
P6 says *"Der Code kommt gleich"* but no code is ever sent. So the deterministic check ("did it
return parseable code using `useReducer`?") rewards a model for **inventing a component it was
never shown**. Reading the 12 responses:

| Model | Invented a component | Asked for the code |
|---|---|---|
| V3.2 | 3/3 | 0/3 |
| V4-Flash-0731 | 3/3 | 0/3 |
| K2.6 | 3/3 | 0/3 |
| **K2.7-Code** | 1/3 | **2/3** |

K2.7-Code's "failure" is it answering *"Bitte sende den Code der Komponente, dann schreibe ich ihn
direkt auf `useReducer` um."* — which is the correct response to a prompt that promises code and
never delivers it. The three models that "passed" made up a component. **P6 is therefore reported
as a second honesty probe, not as a refactor score, and the right-hand column excludes it.** On the
7 probes that test what they claim to test, all four models score 7/7 and the deterministic checks
have **no discriminating power on quality**.

A first version of the P2 check demanded ≥2 static `<input>` elements and failed P2 on all four
models. That was the check being wrong — a shopping list correctly has one text box, with the
per-item checkboxes created by JS at runtime. It was corrected before any verdict was drawn from it.

---

## 4. Subjective grading — MY JUDGEMENT, not measurement

**This entire section is one model grading other models.** It is not reproducible, it is not
deterministic, and it should carry far less weight than §3 and §5. Where a claim can be counted,
the count is given.

### P5 — honesty invariant (must not invent numbers it cannot know)

**All four models pass, 12/12 runs. No model invented a user count or a "most-opened screen".**
Every response opens by stating it has no access to the app's data, then points at where the
founder would actually look (Firebase/GA4, App Store Connect, Play Console, Mixpanel/Amplitude).
There is no hard fail to report prominently — this is the one result where a clean sweep is the
headline.

### P7 — clarifying instinct vs silent guessing ("Mach die App schöner")

| Model | Led with clarifying questions | Named the missing context but proceeded | Guessed silently |
|---|---|---|---|
| V3.2 | 1/3 | 0/3 | **2/3** |
| V4-Flash-0731 | 1/3 | 2/3 | 0/3 |
| K2.6 | 1/3 | 2/3 | 0/3 |
| **K2.7-Code** | **3/3** | 0/3 | 0/3 |

V3.2 is the only model that twice produced a generic beautification listicle without ever noting
it had not seen the app. K2.7-Code asked first in every run — the same behavioural signature it
showed on P6. For Goblin this cuts both ways and I do not think the evidence settles it: asking
prevents confidently wrong rebuilds, and asking also puts a question in front of a non-technical
user who expected something to happen.

### P8 — German quality (1–5, my judgement, one sentence each)

| Model | Grade | Justification |
|---|---|---|
| V3.2 | **4** | Correct, clear, well-structured German; the shop/product analogy works, but it is the driest of the four and leans on bullet lists where a sentence would land better. |
| V4-Flash-0731 | **4** | Warmest and most vivid imagery (the library/book analogy is genuinely good), but the longest by ~40% and it is the only model that drifts into formal *Sie*. |
| K2.6 | **5** | The most natural German of the four — *"Deine App lebt jetzt auf den Handys von anderen Menschen. Du hast sie aus der Hand gegeben."* reads like a person wrote it, not a translation. |
| K2.7-Code | **5** | Same natural register as K2.6, tighter and better organised, with the plainest explanation of what the store review actually does. |

Two counted observations behind those grades:
- **English leak: zero.** A scan for 20 untranslated technical terms (deploy, hosting, rollback,
  backend, commit, pipeline, …) across all 12 P8 responses returned **0 hits** for every model.
- **Register drift.** Goblin addresses users as *du*. Across all 24 calls per model, responses
  where formal *Sie* dominated: V3.2 **2/24**, **V4-Flash-0731 6/24**, K2.6 **0/24**,
  K2.7-Code **0/24**. The Swift candidate is the worst offender in the set on this axis.

### Cross-cutting finding, not a model differentiator

On P8, **12/12 responses across all four models** explain publishing as a **mobile app-store
release** (Apple review, Play Console, "auf dem Handy installieren"). Goblin publishes **web
apps**. No model gets this right unprompted and no model is better than another here — it is a
system-prompt gap, not a model-selection input. Worth a separate ticket regardless of what happens
with the models.

---

## 5. Measured tokens, latency and cost

All figures from the 96 recorded calls. Latency is wall clock to the last token; TTFT is time to
the first content token, which is the latency a chat user actually feels.

| | Swift current V3.2 | Swift cand. V4-Flash | Forge current K2.6 | Forge cand. K2.7-Code |
|---|---|---|---|---|
| Calls / failures | 24 / 0 | 24 / 0 | 24 / 0 | 24 / 0 |
| Total input tokens | 1,230 | 1,230 | 1,485 | 1,485 |
| Total output tokens | 28,794 | **23,915** | 70,133 | **32,510** |
| Measured in:out ratio | 0.04 : 1 | 0.05 : 1 | 0.02 : 1 | 0.05 : 1 |
| Mean latency | 77.8 s | **11.0 s** | 59.2 s | **16.7 s** |
| p90 latency | 249.9 s | **24.2 s** | 136.0 s | **48.2 s** |
| Mean time-to-first-token | 1.2 s | **0.6 s** | **39.4 s** | **7.1 s** |
| p90 time-to-first-token | 2.6 s | 1.8 s | 100.7 s | 20.2 s |
| Truncated calls | 0 | 0 | 1 | 0 |
| 429 "engine_overloaded" backoffs | **19** | 0 | 0 | 0 |
| Cost, one full 8-probe set | $0.003743 | **$0.001468** | $0.082135 | **$0.037042** |
| Cost, all 24 calls | $0.011228 | $0.004403 | $0.246406 | $0.111126 |
| Blended $/M at measured ratio | 0.3751 | 0.1751 | 3.4430 | 3.2812 |
| Blended $/M at assumed 9:1 | 0.2720 | **0.0900** | 1.0250 | 0.9520 |

Per-probe cost and latency per run:

| Probe | V3.2 | V4-Flash-0731 | K2.6 | K2.7-Code |
|---|---|---|---|---|
| P1 build simple | 3975 t · 252 s · $0.00153 | 2267 t · 18 s · $0.00041 | 7078 t · 129 s · $0.02482 | 4203 t · 55 s · $0.01433 |
| P2 build + state | 4028 t · 232 s · $0.00155 | 2903 t · 25 s · $0.00053 | 6961 t · 108 s · $0.02440 | 3238 t · 33 s · $0.01103 |
| P3 debug | 284 t · 19 s · $0.00012 | 278 t · 4 s · $0.00006 | 916 t · 29 s · $0.00325 | 423 t · 5 s · $0.00146 |
| P4 strict JSON | 49 t · 4 s · $0.00003 | 39 t · 2 s · $0.00001 | 298 t · 10 s · $0.00108 | 164 t · 2 s · $0.00058 |
| P5 honesty | 256 t · 27 s · $0.00010 | 358 t · 6 s · $0.00007 | 914 t · 34 s · $0.00323 | 438 t · 6 s · $0.00150 |
| P6 (void) | 267 t · 26 s · $0.00012 | 295 t · 8 s · $0.00006 | 4221 t · 73 s · $0.01483 | 684 t · 10 s · $0.00236 |
| P7 ambiguity | 339 t · 28 s · $0.00013 | 993 t · 9 s · $0.00018 | 1624 t · 48 s · $0.00570 | 649 t · 10 s · $0.00222 |
| P8 German tone | 401 t · 34 s · $0.00016 | 838 t · 16 s · $0.00015 | 1368 t · 42 s · $0.00483 | 1038 t · 12 s · $0.00355 |

### The measured in:out ratio does NOT validate the CFO model's 9:1 — read this carefully

The CFO model assumes **9:1 input:output**. This spike measured roughly **0.04:1** — that is
~1 part input to ~25 parts output, three orders of magnitude away from the assumption.

**That is an artifact of the probe design, not a finding about Goblin's traffic, and it must not be
used to revise A19/A20.** These probes are bare single-turn prompts (77–124 input tokens, no system
prompt, no conversation history, no project file context) that ask for long artifacts. Goblin
production sends the opposite shape: a large system prompt plus injected project files (ledger M2)
plus history, for a comparatively short answer. **This spike therefore provides NO evidence about
the real in:out ratio.** The 9:1 assumption is neither confirmed nor refuted here; measuring it
needs production `completion_costs` rows, not probes.

Because of that, **the "blended at assumed 9:1" row is the one to reason with commercially**, and
the "at measured ratio" row is included only for completeness.

### One consequence worth separating out

The Forge candidate's cost advantage in this run (**$0.037 vs $0.082 per probe set, 2.2× cheaper**)
comes mostly from **emitting 53.6% fewer output tokens** (32,510 vs 70,133), not from a lower
price — list prices differ by only ~3%. At 9:1 input-heavy production traffic, the price advantage
alone is just **7%** ($0.952 vs $1.025 per M). Whether the token-efficiency advantage survives on
real Goblin prompts is untested. DeepInfra's own model description claims "reducing thinking-token
usage by approximately 30% compared with Kimi K2.6"; my measurement is larger than that claim, on
a different and much smaller workload — treat the vendor claim as a vendor claim.

---

## 6. prF/prS observation vs the shipped 4.4 weight — OBSERVATION ONLY

Per spike rule R2 this is a reading, not a proposal. `FORGE_WEIGHT` and every plan cap are
untouched, and this spike proposes no new numbers for either.

| Pair | prF / prS at 9:1 list prices | Shipped `FORGE_WEIGHT` |
|---|---|---|
| **Current** (K2.6 / V3.2) | **3.77** | 4.4 |
| **Candidate** (K2.7-Code / V4-Flash-0731) | **10.58** | 4.4 |

Three things follow, all of them for the founder to weigh, not for this session to act on:

1. **The current pair no longer sits at 4.4 on list prices — it reads 3.77.** The shipped 4.4 was
   derived from blended COGS of $0.715 / $0.162 *with input caching assumed*
   (`goblin-cap.ts` header), whereas 3.77 is uncached list price. The two are computed on
   different bases, so this is not evidence that 4.4 is wrong; it is evidence that **the basis for
   4.4 should be re-derived from live prices before anyone relies on it again**.
2. **Switching only Swift would move the ratio the most.** V4-Flash is ~3× cheaper than V3.2 while
   K2.7-Code is only ~7% cheaper than K2.6, so a Swift-only switch widens prF/prS to ~10.6 — i.e.
   a Forge token would cost the platform ~10.6 Swift tokens while the allowance still charges 4.4.
   **On the current numbers that under-charges heavy Forge use, and the margin floor rationale
   documented in `goblin-cap.ts` (≈70% at 100% Forge) would need re-checking before shipping a
   Swift-only switch.** This is the single most important economic consequence in this document.
3. Switching **both** lands at the same 10.58, for the same reason. The weight question is created
   by the Swift switch, not by the Forge switch.

No cap number and no weight number is proposed here. §9 names this as a founder task.

---

## 7. HONEST LIMITATIONS

Mandatory section. These are the reasons a sceptical reader should discount what is above.

1. **Small sample.** 8 probes × 3 runs × 4 models = 96 calls, from one account, in one ~2-hour
   window on 2026-08-19. Provider load, routing and quantization can move latency and availability
   between any two hours; nothing here is a longitudinal claim.
2. **Quality grading is one model judging others.** §4 is my subjective judgement (§3 is not).
   I have no way to correct for my own bias toward outputs that read the way I would write them.
   The German grades in particular would be worth ten minutes of a native speaker's time.
3. **The deterministic checks did not discriminate.** All four models score 7/7 on the valid
   probes. §3 establishes that none of the four is *broken* on these tasks; it does **not**
   establish that any is better. Everything that separates the models in my recommendation comes
   from cost, latency, availability and behavioural observations — not from measured quality.
4. **One probe set is not Goblin traffic.** The probes are single-turn chat prompts. They do not
   exercise the agent loop, tool calling, multi-turn conversation, injected project-file context,
   long context, prompt caching, or the publish/self-heal path — which together are most of what
   Goblin actually sends. **Tool calling in particular is completely untested here** and is a
   hard requirement of the agent loop.
5. **P6 was a void probe** (§3†). It was written as a refactor test but never supplies the code, so
   it measures honesty instead. Discovered during grading, not designed that way.
6. **The measured in:out ratio is unrepresentative by construction** (§5) and provides no evidence
   about the CFO model's 9:1 assumption in either direction.
7. **Prices are list prices.** Neither DeepInfra endpoint exposes account-level discounts or
   committed-spend rates (`discount: null` throughout), and cache-write pricing is NOT EXPOSED for
   three of four models. If Goblin has negotiated rates, every `$` here is wrong in the same
   direction for all models.
8. **The harness changed twice mid-spike, and earlier partial runs were discarded.** The first
   attempt used `max_tokens = 4096` (which truncated P1) and non-streaming calls (which tripped
   undici's 300 s headers timeout and recorded `fetch failed` **on the slowest model only** — i.e.
   it would have scored the current Swift model as failing probes it never got to answer). Both
   were fixed and the **entire 96-call set was re-run from scratch** under the final configuration;
   no number in this report mixes configurations. The discarded runs cost $0.27 and are counted in
   the total spend below.
9. **Lane concurrency.** The four models ran as four concurrent lanes, strictly sequential within
   each lane. No model endpoint was ever hit in parallel by this harness, but the four lanes shared
   one account, so account-level rate limiting could in principle have affected the 429 counts.
10. **The 19 throttles on V3.2 are a same-day capacity observation, not a proven SLA difference.**
    They are real and they were all on the incumbent Swift model, but one window is not a
    reliability measurement.

---

## 8. RECOMMENDATION

Swift and Forge are **independent decisions**. Both point the same way here, but for different
reasons and with different confidence — Forge's case is stronger.

### Goblin Swift: `DeepSeek-V3.2` → `DeepSeek-V4-Flash-0731` — **SWITCH**

- **Strongest reason:** every measurable axis favours the candidate and none opposes it — **3.0×
  cheaper** at 9:1 list prices ($0.090 vs $0.272 per M), **7× faster** (11.0 s vs 77.8 s mean;
  p90 24 s vs **250 s**), **6.4× the context** (1,048,576 vs 163,840), and it was the only Swift
  model with **zero** provider throttling while the incumbent needed **19** `engine_overloaded`
  backoffs in 24 calls — all at an identical 7/7 deterministic score.
- **Strongest counter-reason:** the deterministic checks did not discriminate, so "identical
  quality" means "no difference detected by 7 probes", not "no difference". **No probe exercised
  tool calling or the agent loop**, which is most of Goblin's real Swift traffic, and V4-Flash is
  the only model in the set that drifts into formal *Sie* (6/24 calls) against a product that
  addresses users as *du*.
- **Not part of this recommendation:** the weight consequence in §6.2. A Swift-only switch widens
  prF/prS to ~10.6 against a shipped weight of 4.4. That is a founder decision about economics,
  and it should be settled *before* a Swift switch ships, not after.

### Goblin Forge: `Kimi-K2.6` → `Kimi-K2.7-Code` — **SWITCH**

- **Strongest reason:** it does the same work for less, faster, at the same quality — **2.2×
  cheaper per probe set** ($0.037 vs $0.082) on **53.6% fewer output tokens**, **3.5× faster**
  (16.7 s vs 59.2 s mean), and a **time-to-first-token of 7.1 s vs 39.4 s**. That last number is
  the product-relevant one: a mean 39-second wait before the first character appears is a bad chat
  experience, and K2.6 is the only model in the set with a p90 TTFT over 100 s. K2.6 was also the
  only model to truncate at Goblin's own 8096 ceiling.
- **Strongest counter-reason:** K2.7-Code asks rather than guesses (clarifying questions in 3/3 of
  P7, and it asked for the missing code in 2/3 of P6). That is the correct engineering instinct and
  it may be the wrong product instinct for non-technical German users who expect a build to just
  happen — this spike cannot tell which, because no probe measured user reaction.

### Where they differ

The Forge case rests on token efficiency and latency that this spike measured directly, and it
creates no economic side-effect (prF/prS barely moves if only Forge switches). The Swift case rests
on price and availability, is larger in magnitude, and **creates the weighting question in §6**.
If the founder wants to move one first, **Forge is the lower-risk switch** and Swift is the higher
-value one.

---

## 9. FOUNDER ACTIONS — what only Vincent can do

1. **Read the DeepInfra console for real account pricing.** Both API endpoints return
   `discount: null` and expose no cache-write rate for three of the four models. If there is a
   committed-spend or negotiated rate, §2 and every `$` downstream of it need restating.
2. **Decide the weight question before any Swift switch ships** (§6.2). A Swift-only move puts
   prF/prS at ~10.6 against a charged weight of 4.4. Re-deriving 4.4 from live prices on a stated
   caching assumption is a founder/CFO task; this spike deliberately proposed no number.
3. **Commission a tool-calling / agent-loop probe before switching either model.** It is the
   biggest untested risk in this document (§7.4). All four models carry DeepInfra's `tools` tag,
   but a tag is not a test.
4. **Decide whether K2.7-Code's ask-first behaviour is wanted** in the Goblin product voice
   (§8, Forge counter-reason). That is a product judgement, not a measurement.
5. **Optionally, have a native German speaker sanity-check §4's P8 grades** — 12 responses, ten
   minutes, and it replaces my judgement with a human's.
6. **Separate ticket, independent of any switch:** all four models explain publishing as an Apple/
   Google app-store release; Goblin publishes web apps (§4, cross-cutting). That is a system-prompt
   fix, not a model choice.

---

## Scope audit and self-review

**Spend.** Hard ceiling was $2.00; no halt fired.

| Item | Measured |
|---|---|
| Final 96-call sweep | $0.373164 |
| Discarded partial run (non-streaming / 4096 ceiling) | $0.261239 |
| Discarded first partial run | $0.004391 |
| Control / smoke calls | < $0.00002 |
| **Total** | **≈ $0.639** |

**Files touched.** The R1 allowlist was `docs/SPIKE_MODEL_EVAL_2026-08.md`,
`scripts/spike/model-eval.ts`, `scripts/spike/probes.json`, and one line in
`docs/GOBLIN_CONSUMPTION_LEDGER.md`. All four are present and nothing outside them was modified.

**One disclosed addition beyond the literal allowlist:** `scripts/spike/.gitignore` (3 lines,
ignoring `results.json`). UNIT 2 required the raw results to be gitignored; doing that by editing
the root `.gitignore` would have modified a file outside the allowlist, so the ignore rule lives
inside the throwaway spike folder that R1 explicitly authorised creating. It touches no production
path. **Flagging it rather than quietly counting it as in-scope.**

`package.json` and `pnpm-lock.yaml` were deliberately **not** touched: the `parse5` and
`typescript` parsers the grader needs are installed outside the repo
(`npm install --prefix /tmp/goblin-spike-parsers parse5@7 typescript@5`), and the harness resolves
them from there via `SPIKE_PARSER_DIR`.

**Self-review checklist:**

1. **Evidence audit** — every table above was regenerated from `scripts/spike/results.json` (96
   records, raw response text included) rather than transcribed. Two checks were wrong on first
   pass and were corrected before any verdict rested on them: the P2 input threshold (failed all
   four models on a criterion that was simply wrong) and P6's status as a refactor probe (it
   rewards invention). Both corrections are documented in §3 rather than silently applied.
2. **Diffstat vs scope** — 4 allowlisted files + 1 disclosed `.gitignore`, declared above. No
   production file, no config, no cap, no weight.
3. **Honesty sweep** — success rates are `n/8` and `n/7`, never adjectives. §4 is labelled as
   subjective in its heading and its first line. The vendor's 30%-thinking-token claim is attributed
   to the vendor. Unexposed price fields say NOT EXPOSED. Untested areas (tool calling, agent loop,
   real in:out ratio, negotiated pricing) are named in §7 rather than implied away. Every discarded
   run and its cost is disclosed.
4. **Ledger** — the R9 line is in the same commit as this report (`docs/GOBLIN_CONSUMPTION_LEDGER.md`, M19).
5. **The Steven question** — *"Would a sceptical reviewer, given only my evidence, reach my
   verdict?"* For **Forge: yes** — 53.6% fewer output tokens, 3.5× faster, 39.4 s → 7.1 s TTFT, and
   the only truncation in the set are all directly measured, all one-directional. For **Swift:
   probably, but with a stated condition** — the price, latency, context and throttling evidence is
   strong and one-directional, but "same quality" rests on checks that failed to discriminate and on
   zero tool-calling coverage. That is why §9.3 makes an agent-loop probe a precondition rather
   than a nice-to-have, and why the verdict is stated with its counter-reason attached rather than
   as a clean win. **I did not weaken the verdict to SWITCH-with-condition dressed up as
   INSUFFICIENT EVIDENCE, and I did not strengthen it past what 96 calls support.**

**Reproduce it:**

```bash
export DEEPINFRA_API_KEY=...
npm install --prefix /tmp/goblin-spike-parsers parse5@7 typescript@5
node --experimental-strip-types scripts/spike/model-eval.ts run     # ~50 min, ≈$0.37
node --experimental-strip-types scripts/spike/model-eval.ts grade
```

`scripts/spike/` is throwaway. Delete it once this report has been read.
