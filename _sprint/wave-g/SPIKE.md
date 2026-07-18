# WAVE-G — Test- & Selbstkorrektur-Tiefe · SPIKE + decision tables (Session 1, HALT)
**Branch `claude/wave-g-74prft` · base `origin/master` @ `d55ea1e` (post Wave-B merge) · Opus · 2026-07-18 · no live review**

**Deliverable of this session:** decision tables + recommendation + three founder gates
(**D-G1** execution env · **D-G2** test scope v1 · **D-G3** billing). **No code built.**
Session 2 (the build) starts only when the founder re-pastes the prompt with:
```
FOUNDER DECISIONS: D-G1=<env> · D-G2=<scope> · D-G3=<billing>
```

---

## Phase 0 — state-first findings (repo trusted over prompt; Law 10 / OS §5b)

I verified every premise the prompt asserts before trusting a word of it. Two hold, **one
is contradicted by the repo — and it is the premise the whole spike rests on.**

| Premise in the prompt | Repo reality | Verdict |
|---|---|---|
| Wave E merged first ("E must be merged first") | PR #49 merged (`4e9148c`); E1–E5 in master | ✅ **holds** |
| Wave-D sandbox model exists to enforce | `_sprint/wave-d/SECURITY_AUDIT.md`: D-1 path canonicalizer (`project-path.ts`, 2-layer), D-2 abuse caps — merged | ✅ **holds** |
| Self-heal 2-cycle cap to reuse | `orchestrator.ts:45` `MAX_HEAL_CYCLES = 2`, `healNarration()`, `agent_narration` steps, honest `healFailureReason()` | ✅ **holds** |
| **"Depends on the runtime-smoke infra (Wave A-3, shipped)"** — Steven's prior: **"reuse the A-3 environment"** | **A-3 was HALTed, not shipped.** `_sprint/wave-a/A3_RUNTIME_SMOKE_SPIKE.md` + `REPORT.md` (`A-3 … ⛔ HALT (spike)`): the JS-execution runtime smoke was **founder-gated and never built**. What ships is `deploy-verification.ts` → `verifyDeployment()`: **fetch-based** reachability + asset-200 + byte-equality. **No headless browser, no JS execution, no Railway browser job exists in `apps/api`.** | ❌ **CONTRADICTED — HALT-worthy** |

**The E4 "headless Chromium runtime smoke" was a one-off proof, not production infra.**
Wave-E's E4 evidence (`evidence/wave-e/runtime-smoke.mjs` + `runtime-smoke-result.json`)
was a standalone script run **in this CC cloud session's pre-installed Chromium**
(`/opt/pw-browsers/…`) to *evidence* the E4 build. It is not wired into any per-user
production request path. Grepping `apps/api/src` for `playwright|chromium|puppeteer|
page\.on|headless` returns **nothing**.

**Consequence for the whole wave — there is NO server-side environment that executes
generated app code today.** Generated apps either (a) ship as static HTML/CSS/JS served by
the user's own Vercel, or (b) for React/Vite (Wave E), are **built on the user's own
Vercel** (`framework:'vite'`, build-from-source) — Goblin never runs the code itself.
So "where do generated tests run?" (spike item 1) is not *reuse an existing runner* — it
is **build the runner A-3 deferred.** Steven's prior ("reuse the A-3 environment") is
sound in *intent* (don't build a parallel execution stack) but rests on a target that does
not exist. The honest translation: **D-G1 for Wave G IS the execution-environment decision
A-3 escalated and the founder never resolved. They are the same gate. Decide it once; the
runtime-smoke A-3 wanted and the test-execution Wave G wants are one service.**

This is exactly the OS §2 case — *"Spike when unknowns outweigh knowns… never pick a vendor
or architecture silently"* — and the unknown is larger than the prompt assumed. Hence: full
decision tables, HALT.

---

## The non-negotiable constraint that shapes every option (HARD RULES + Wave-D)

Running **model-generated code** is the security surface the prompt flags. The execution
environment **MUST** enforce the Wave-D sandbox model, **verified on the runner, never
weakened**:

- **No secret access.** The runner holds **zero** env secrets. The API process holds the
  crown jewels (DeepInfra key, Supabase **service-role**, master KEK, Stripe, VAPID —
  scrubbed by D-3 but *present*). Executing arbitrary generated code **in the API process
  or its container** would hand that code the secret environment. → **The API process is
  categorically OFF the table as an execution env**, for both browser and Node tests.
- **No egress to internal services.** Deny-all network except loopback (the app serves
  itself on `127.0.0.1` for the browser to hit). No reaching the Goblin API, Supabase, the
  Railway internal network, or the cloud metadata endpoint.
- **Resource caps.** CPU, memory, wall-clock timeout (kill runaway/infinite-loop tests),
  PID/process cap, output-size cap — mirroring D-2's ceilings.
- **Verified adversarially, on the runner.** A test in the runner that tries to read a
  secret, reach an internal host, or spin CPU past the cap → must be **denied/killed**
  (an adversarial suite mirroring D-1's path-traversal tests). "Green is what was seen"
  (Law 2) applies to the sandbox itself.

This constraint is why the recommendation cannot be "run it where the smoke runs today" —
nothing runs generated code today, and the one process that *could* (the API) is the one
that must never.

---

## D-G1 — Execution environment (where do generated tests run?)

Options, each scored on cost, latency, safety (the Wave-D constraint above), and infra
reuse. **This gate also finally resolves A-3's deferred runtime smoke — the same runner
serves both.**

| # | Option | Mechanism | Wave-D safety | Cost / billing side | Latency | Reuse / new surface | Verdict |
|---|---|---|---|---|---|---|---|
| **A** | **In the API/Railway process** (in-proc or child process) | Run vitest/Playwright inside the existing API container | ❌ **DISQUALIFIED** — shares the secret env + internal network with generated code | ~0 infra | low | max reuse | **REJECTED** — violates "no secret access", the core constraint. Also A-3 already rejected co-locating Chromium here (image +300 MB, cold-start/memory unverifiable). |
| **B** | **Dedicated Goblin-owned sandboxed runner** (separate Railway service / worker, secret-free, deny-egress, capped) | A new small service receives *only* project files + generated tests; runs Playwright (browser) and/or vitest (Node); returns structured results; **holds no secrets, no internal egress** | ✅ **can fully satisfy** — isolation is designed in from an empty-env container + network policy + cgroup caps | **Platform COGS**: one small worker (idle-cheap if on-demand). No new *paid vendor*. | med (net hop + browser cold-start) | New service (**founder gate**: OS §4 "New dependencies / Security model"), but owns the stack — consistent with the recorded own-Vercel / user-connected-Supabase philosophy | **RECOMMENDED (primary)** — the security-correct answer that also honors "no new paid vendor". Primary risk: **rolling multi-tenant sandbox isolation is genuinely hard** (this is the surface the prompt warns about) — must be adversarially verified before it runs one line of user code. |
| **C** | **Extend the user's own Vercel build** (Wave-E build-from-source) | Run `npm test` (vitest) inside the Vercel build step | ⚠️ partial — Vercel's build sandbox is the user's, isolated from Goblin secrets; **but** only exists for **framework** projects, is **build-time only** (no drivable served URL → **no behavior tests**), and conflates "build passed" (already have) with "tests passed" | $0 platform (user's Vercel) | high (full build) | reuses E3 | **PARTIAL** — viable *only* for vitest logic tests on framework projects; cannot do behavior tests or vanilla-HTML apps. A useful **v2 add-on**, not the v1 answer. |
| **D** | **External purpose-built sandbox vendor** (e2b / Modal / Daytona / Browserbase-class) | POST files+tests to a hosted, isolated sandbox; read structured results | ✅ isolation is the vendor's product | **New PAID service** → Law 8 founder gate; per-run price + egress | low–med | zero infra to build; but a vendor dependency + data leaves Goblin | **RUNNER-UP** — fastest path to a *correct* security posture (no need to harden your own container isolation). Choose over B if speed-to-safe outweighs adding a paid vendor + sending user code off-platform. |
| **E** | **This CC cloud session's Chromium** (what E4 did) | The pre-installed `/opt/pw-browsers` Chromium | n/a | ~0 | n/a | — | **NOT a production env** — it is the *build/dev* sandbox, absent from the prod request path. **Keep it for the Session-2 PROOF gate only** (see below), never as D-G1. |

**Recommendation: D-G1 = B** (dedicated Goblin-owned, secret-free, deny-egress, capped
runner), serving **both** the deferred A-3 runtime smoke and Wave-G test execution, with
**Playwright behavior tests** as the v1 flavor (see D-G2). Rationale: (1) it is the only
option that satisfies the non-negotiable Wave-D constraint *and* the recorded "own the
stack / no new paid vendor" philosophy (own-Vercel, user-connected Supabase); (2) it
retires A-3's debt in the same unit. **Honest counter-weight:** if the founder does not
want to own + adversarially harden container isolation, **D (a sandbox vendor)** is the
faster route to the same safety, at the cost of a paid vendor + user code leaving the
platform. **Either B or D is a founder decision; A is disqualified; C is a v2 add-on.**

---

## D-G2 — Test scope v1

The ladder: **smoke** (have it — `verifyDeployment`) → **behavior** (click X, expect Y) →
**full unit** (vitest logic).

| Scope | What it verifies | Fit to Goblin ethos | Works on vanilla HTML? | Env needed (couples to D-G1) | Verdict |
|---|---|---|---|---|---|
| Smoke (reachability) | page loads, assets 200 | "not broken" | ✅ (shipped) | none (fetch) | **already have** — the floor |
| **Behavior** (Playwright) | "delete a habit" → add, delete, **assert gone**; "counter" → click −, **assert not < 0** — derived from the user's *stated intent* | ✅✅ **the "macht es wirklich, was es soll" ethos** — claims backed by a passing behavior test | ✅ **yes** — drives the rendered DOM of ANY app | **browser sandbox** (D-G1=B or D) | **RECOMMENDED v1** |
| Full unit (vitest) | exported logic functions | ✅ but narrower | ❌ needs exported testable units (framework only) | Node sandbox (lighter; enables D-G1=C) | **v2** — deferred |

**Recommendation: D-G2 = behavior** (Playwright), derived from the user's stated intent via
**few-shots** (the E2 scaffold-few-shots pattern: intent → the 2–3 assertions that prove
it). Rationale: behavior tests are the purest expression of the Feeling invariants — *"the
delete button works" becomes verified, not hoped* — and they work on **every** generated
app, not just framework ones. **Coupling to note for the founder:** behavior tests require
the **browser** sandbox, so **D-G2=behavior implies D-G1 ∈ {B, D}** (not C). Choosing vitest
scope instead would make the lighter Vercel-build path (C) viable but would only cover
framework projects with exported logic — a poorer fit for "does the button work". The
proof gate itself ("Zähler geht nicht unter 0") is behavior-shaped, reinforcing this.

---

## D-G3 — Billing (generation vs execution)

Two distinct consumption events:

| Event | What consumes | Billing side | Ledger |
|---|---|---|---|
| **Test generation** | model completion tokens to write the test code (one agent turn) | **User allowance** — folds into **M10** (agent-run tokens); no new billing path | existing M10 |
| **Test execution** | compute in the sandbox runner (CPU-seconds / a vendor per-run price) | **Platform COGS** — exactly like the A-3 runtime smoke would have been; **additive/opt-in, never publish-blocking** (LIVE-USER rule) | **new M16** |

**Recommendation: D-G3 = execution is platform COGS, generation is user-billed** — I concur
with the prompt's prior, with two Wave-D-consistent additions:

1. **A per-user execution cap** (`TEST_RUNS_PER_HOUR` / `TEST_RUNS_PER_DAY`, default in the
   D-2 style) so a user cannot loop "Tests ausführen" and run up platform COGS. A denied
   run consumes no budget and returns honest German copy (D-2 pattern).
2. **A new ledger row M16** (next free — M1…M15 exist; Session 2 re-confirms state-first),
   written **in the same commit** as the execution path (Law 5), carrying: **Trigger**
   (a `run_tests` invocation), **Formula** (gen tokens → M10; execution = capped
   CPU-seconds × rate, or vendor per-run price × runs), **Knob + location** (auto-generate
   toggle, per-run wall-time cap, per-user run cap), **Billing side** (gen = user
   allowance; execution = **platform COGS**), **CFO figure** (a *new* platform-COGS line:
   execution COGS/run × runs/user — bounded by the cap above). **MEASURE, don't estimate**
   (the M14 lesson: the spike's guess was corrected down by measurement).

---

## What Session 2 builds once the gates are filled (preview, from the prompt)

- **G1** Test generation after a feature build, derived from stated intent (few-shots);
  tests **stored with the project — visible, not hidden**.
- **G2** Test execution + a `run_tests` tool per **D-G1**; structured results (pass/fail
  per test + failure detail).
- **G3** Self-correction: failing tests feed the **existing bounded 2-cycle loop**
  (`MAX_HEAL_CYCLES=2`, `orchestrator.ts:45`) → narrated (F-11 honest-narration rules /
  `healNarration`) → honest finish if unfixable. Report card: **"Tests: 4/4 grün"** or an
  honest failure.
- **G4** User control: settings **"Tests automatisch generieren"** + **"Tests ausführen"**
  action. **Never publish-blocking**; a red test **warns clearly before "Live stellen"**
  but never blocks publish (LIVE-USER rule).
- **G5** Honest edges (DE+EN) + the M16 ledger row.

**The proof gate (Session 2):** `Baue einen Zähler mit Plus- und Minus-Knopf, der nicht unter
0 geht — und teste dass er nicht unter 0 geht.` → agent builds, generates the floor-condition
behavior test, runs it (in the D-G1 runner), passes; then a fixture where the first attempt
**has** the bug → the test **catches** it → the 2-cycle self-correction **fixes** it → green.
Evidence = test code + run results + step log. (The CC-session Chromium — option E — is the
right vehicle to *evidence* this proof, exactly as E4 did; it is not the production env.)

---

## Founder gates — DECIDE, then re-paste for Session 2

**D-G1 (execution environment) — RECOMMEND `B`** (Goblin-owned secret-free, deny-egress,
capped sandbox runner; also retires A-3's deferred runtime smoke). Runner-up **`D`** (a
purpose-built sandbox vendor) if you prefer speed-to-safe over owning + hardening isolation.
`A` is disqualified (secret access). `C` is a v2 add-on (framework-only, no behavior tests).

**D-G2 (test scope v1) — RECOMMEND `behavior`** (Playwright, intent-derived few-shots).
Implies D-G1 ∈ {B, D}. `unit` (vitest) is deferred to v2 and would only cover framework
projects.

**D-G3 (billing) — RECOMMEND `execution = platform COGS, generation = user allowance`**,
plus a per-user execution cap and a new **M16** ledger row (measured, same commit).

```
FOUNDER DECISIONS: D-G1=<env> · D-G2=<scope> · D-G3=<billing>
```

## Honest limitations of this spike
- **No code built, no runner stood up, no cost measured.** The M16 numbers are a *strategy*,
  not a measurement — Session 2 measures them (M14 lesson).
- **The prompt's "A-3 shipped / reuse it" premise is false** (verified above) — the biggest
  finding of this session. If the founder believed A-3's runtime smoke already ran in prod,
  that belief is corrected here: it was HALTed. This makes D-G1 a **build**, not a *reuse*.
- **B's isolation is the hard part.** Recommending B does not make secure multi-tenant code
  isolation easy — it is the exact surface the prompt flags. Session 2 must **adversarially
  verify the sandbox on the runner** (secret-read denied, internal-host egress denied,
  CPU/wall-time cap enforced) before any user code runs, or B is not done.
- **B vs D is a genuine founder call**, not a formality: own-the-stack + no-vendor (B) vs
  speed-to-correct-isolation + a paid vendor + user code off-platform (D). I recommend B on
  philosophy-consistency grounds but the security-maturity argument for D is real and stated.

**HALT.** Awaiting founder decisions D-G1 · D-G2 · D-G3.
