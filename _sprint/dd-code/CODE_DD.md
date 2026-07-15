# GOBLIN — CODE-LEVEL DUE DILIGENCE (hostile technical acquirer)
**Read-only audit · 2026-07-15 · branch `claude/dd-code-audit-ty53m2` · zero code changes (this report is the only commit).**

This is the **code half** the strategic DD (`GOBLIN_DD_REVIEW.md`) explicitly could not perform. It grades the same product from inside the source tree: dependencies, secret history, test reality on the money paths, dead code, single-node assumptions, and error handling. Evidence is cited as `file:line`. Anything not provable from the repo is marked **UNGRADEABLE**, never guessed.

Method note (methodology Law 2 — "Grün ist, was gesehen wurde"): every load-bearing claim below was opened and read first-hand by the auditor, not inferred. Where a finding originated in a fan-out reader, the specific line was re-verified before inclusion.

---

## What a buyer's engineer flags in hour one

An acquirer's engineer runs five reflexes on day one. Here is what each returns on Goblin:

1. **`pnpm audit`** → the npm advisory endpoint answers **HTTP 410** in a sandboxed network, so there is no one-command vuln number. Reading the lockfile by hand instead: the tree is disciplined — `pnpm.overrides` actively pins four CVE'd transitives (`fast-uri`, `ws`, `brace-expansion`, `fast-xml-parser`), and `form-data`/`cross-spawn`/`nanoid`/`semver`/`postcss`/`cookie` all sit at or above their patched floors. One real client-side CVE survives (`prismjs@1.27.0`), plus stale-but-not-vulnerable majors (`@anthropic-ai/sdk@0.27.3`, `stripe@16`).
2. **`git log -p | grep` for secrets** → **clean across all 252 commits and all refs.** No key was ever committed; every hit is a placeholder, a masked dashboard mock (`sk_live_••••••42`), or a scrubber test-fixture. This is rare and it is a genuine point in the founder's favour.
3. **Open CI, see green, then look harder** → the green is partly hollow. The API test job runs `vitest` with **no `STRIPE_SECRET_KEY`**, and the real-money integration suites are written `const skip = HAS_TEST_KEY ? describe : describe.skip`. So on **every CI run**, proration, the first-charge subscribe path, price→tier mapping, and the deepest purge-completeness proof contribute **zero assertions**. The build is green on paths that never touched money. This is the hour-one gut-punch.
4. **Read `run-registry.ts`** → a module-level `new Map()` (`:86`) is the live-run store, with **no global concurrency cap anywhere in the process**. This is a single-box product; the scale story is a Wave-H *document*, not code. Horizontal scale-out today silently multiplies every abuse limit by the replica count and breaks live-Stop.
5. **Read the money/purge tails** (`cancel-refund`, `account-deletion`) → the failure branches are "best-effort": a failed refund or a failed Vercel teardown writes a log line, the job is marked `done`/`completed`, and **nothing retries**. Under partial failure this is silent money loss and silent data-retention leakage.

**One-paragraph verdict.** The codebase is unusually honest, unusually disciplined, and well-tested *on its surface* — the anti-pattern catalog in `GOBLIN_ARBEITSMETHODIK.md` is visibly enforced (webhook-200 ordering is correctly fixed, idempotency is textbook, secrets are scrubbed, dead code is near-zero). The risk is concentrated in exactly two places the strategic DD *could not see from the outside*: **(a) the CI-skip that hollows out the money-test green**, and **(b) the best-effort money/purge failure tails**. Everything else the buyer flags — single-node scaling, no load test — the founder's own docs already confess (Wave H unrun, DR unprobed). A buyer's remediation list and the founder's roadmap remain, as the strategic DD noted, largely the same document — with these two additions the strategic pass missed.

---

## The five worst truths (ranked)

1. **A failed cancellation refund is money the user is owed and silently never gets.** `handleSubscriptionDeleted` awaits `refundRemainingCreditOnCancel` but **discards its return value** (`billing-service.ts:748`). A `failed` status — no refundable charge, Stripe error, or timeout (`:667-670`, `:685-688`, `:712-717`) — produces only a `logger.error` line; the webhook job is marked done and **nothing retries or alerts**. The credit owed on cancellation simply never leaves Goblin's balance. `CRITICAL`.

2. **The green build does not test the paths that move money.** Proration parity (`change-plan-immediate.test.ts:134`), the double-billing guard (`change-plan.test.ts:196`), first-charge subscribe (`createSubscriptionAtTier`, `billing-service.ts:255`), and price→tier mapping all live inside `describe.skip` blocks that require a `sk_test_` key CI never supplies (`ci.yml` api-tests job, no `STRIPE_SECRET_KEY`). A "paid for Power, granted Build" or a double-charge bug **ships green**. `HIGH`.

3. **Deleted users' live sites stay public and billable forever, and the deletion is reported "completed."** Vercel teardown is warn-only on failure (`account-deletion.ts:506-511`), then the run unconditionally cascade-deletes the `projects` rows (`:550`) and stamps `status:'completed'` (`:556`). The comment promises "will retry next cron pass," but the row is `completed` and the project names are gone — **the retry is unreachable.** GDPR Art. 17 exposure + third-party cost on the user's own token. `HIGH`. (Contrast: the *storage* purge correctly blocks the cascade with a `throw` at `:529` — proof the right pattern exists in the same function and was simply not applied to Vercel.)

4. **The "truth-gated deploy" — the honesty centerpiece — never has its content-match branch tested.** `deploy-verification.test.ts:7` mocks `downloadFile` to always return `null`, so `expectedEntry` is always `null`, so the byte-truth comparison `servedHtml !== expectedEntry` (`deploy-verification.ts:82`) **never executes in any test.** A URL that returns HTTP 200 with stale or wrong content passes the gate and the agent claims `Live ✓`. The single most load-bearing assertion of the product's differentiator is unverified. `HIGH`.

5. **It is a single-box product with no admission control, and the first thing to break at load is the shared circuit breaker.** The live-run registry (`run-registry.ts:86`), rate limits (`rate-limit.ts:6`), abuse caps (`abuse-caps.ts:36`), cache (`cache.ts:15`), and circuit breaker (`circuit-breaker.ts:82`) are all in-process `Map`s, and a grep for `p-limit`/`semaphore`/`maxConcurrent` finds **nothing**. At 100 concurrent runs on one node, 3 upstream failures OPEN the shared breaker (`failureThreshold` 3) and **reject every run's calls to that provider at once** — turning provider throttling into a full-node agent outage. On scale-out, every in-process limit multiplies by replica count and live-Stop breaks. `HIGH` at growth. (This is the DD's T-2/T-3, now concrete.)

---

## Master findings table

Severity: `CRIT` / `HIGH` / `MED` / `LOW` / `INFO`. Effort: hours / days / weeks.

| ID | Finding | Sev | Evidence (`file:line`) | Remediation | Effort |
|----|---------|-----|------------------------|-------------|--------|
| **E-1** | Failed cancel-refund discarded; owed money never paid, log-only, no retry | CRIT | `billing-service.ts:748`, `:667-670`, `:685-688`, `:712-717` | Persist `pending_refund` + reconciliation cron that retries `failed`/`refunded_balance_unadjusted` | days |
| **E-2** | Balance-zero txn not idempotency-keyed → card refund **and** retained credit (double benefit) | HIGH | `billing-service.ts:693-701` (unkeyed) vs `:680` (keyed) | Idempotency-key the balance txn; retry on `refunded_balance_unadjusted` | hours |
| **E-3** | Vercel teardown warn-only, then cascade + `completed` → orphaned public+billable site forever | HIGH | `account-deletion.ts:506-511` → `:550` → `:556` (vs correct `throw` at `:529`) | Block completion on `!td.ok` like the storage purge does | days |
| **T-1** | Money-path integration suites self-skip in CI (proration/subscribe/tier/purge-PROOF4) | HIGH | `change-plan.test.ts:125`, `change-plan-immediate.test.ts:98`, `account-deletion.test.ts:191`; `ci.yml` api-tests job has no `STRIPE_SECRET_KEY` | Provision `sk_test_`+price ids as CI secrets and run gated suites, or add a mocked-Stripe layer | days |
| **T-2** | Deploy content-match truth-gate never executed (mock forces `expectedEntry=null`) | HIGH | `deploy-verification.test.ts:7`; dead branch `deploy-verification.ts:82-85` | Test with non-null `expectedEntry`: match-passes and mismatch-fails | hours |
| **T-3** | `purgeProjectStorage` verify-empty orphan-check mocked away in all deletion tests; no direct test | HIGH | mocked at `account-deletion.test.ts:132`, `account-deletion-teardown.security.test.ts:67`, `account-deletion-events-purge.test.ts:72`; untested code `file-storage.ts:583-625` | Direct test of re-list/`failed` path + the `:526` throw guard | days |
| **N-1** | In-process live-run registry; cross-replica Stop broken; no global concurrency cap | HIGH@scale | `run-registry.ts:86`, `:200-205`; no `p-limit`/`semaphore` in tree | Wave H: DB/Redis registry + sticky sessions + global admission control | weeks |
| **N-2** | In-process rate-limit + abuse-cap stores → limits ×replicas on scale-out | HIGH@scale-out | `rate-limit.ts:6` (self-documented `:3-5`), `abuse-caps.ts:36` | Redis-backed limiter (already flagged in-code as the fix) | days–weeks |
| **N-6** | No global concurrency admission control; 100 concurrent breaks at LLM+shared breaker first | HIGH@load | negative grep; `code-sessions.ts:646` is per-user only; `circuit-breaker.ts:13,82` | Global in-flight cap + per-provider breaker keyed shared store | weeks |
| **D-1** | `prismjs@1.27.0` (via `react-syntax-highlighter`→`refractor@3.6.0`) — CVE-2024-53382 DOM-clobbering, renders generated file content | MED | lockfile `prismjs@1.27.0`; consumer `file-viewer-modal.tsx:5` | `pnpm.overrides` prismjs `>=1.30.0`, or migrate modal to `shiki` (already a dep) | hours |
| **E-4** | Charged-but-told-failed: charge succeeds, entitlement write throws → 500 "failed" | MED | `billing-service.ts:294-310`, `:469-478`; routes `billing.ts:125-127`, `:173-174` | Treat post-charge entitlement failure as non-fatal warn; return success (webhook reconciles) | hours |
| **E-5** | `markDeployed` swallowed after verified deploy → `Live ✓` but URL never persisted; DB blip reports live site as error | MED | `agent/publish.ts:201` (`.catch(()=>{})`); `deploy.ts:160-163` inside outer try `:244` | Log the failure; move the persist out of the throwing block | hours |
| **E-6** | Synchronous money endpoints not wrapped in `withTimeout` (webhook path is) | MED | raw `stripe.*` at `billing-service.ts:294`, `:469`, `:389`, `:113` (vs wrapped `stripe-webhook-processor.ts:69-112`) | Wrap external money calls in `withTimeout` budgets | hours |
| **N-3** | In-process circuit breaker → 3 failures reject all node runs to a provider; inconsistent cross-replica | MED–HIGH | `circuit-breaker.ts:82`, `:13`, `:30-37` | Shared-store breaker; per-provider half-open probes | days |
| **N-4** | In-process cache; plan/entitlement stale up to 5 min TTL cross-replica after a change | MED@scale-out | `cache.ts:15`, `:94`; `cacheDelPattern` local-only `:42-47` | Shared cache or pub/sub invalidation | days |
| **N-5** | In-process cron `setInterval` double-fires on >1 replica if `ENABLE_CRON` set (dup digests, double hard-delete attempt) | MED | `cron.ts:19,32`; `index.ts:254`; jobs `:45,69,81,93,103` | Single leader or external scheduler (GH Actions cron already partly used) | days |
| **T-4** | `routes/deploy.ts` + `vercel-service.ts` `deployToVercel`/`getDeployStatus` have no tests (forward publish only mocked) | MED | no test file; `routes/deploy.ts:50-143`, `vercel-service.ts` | Integration/contract test of the forward deploy path | days |
| **T-5** | `routes/billing.ts` subscribe/checkout/setup-intent endpoints untested | MED | only `/webhook`,`/status`,`/confirm-plan` covered | Route tests for the purchase entry points | days |
| **T-6** | DB FK cascade completeness on hard-delete UNGRADEABLE at unit layer (fakes stub `deleteUser`) | MED | `account-deletion.ts:550`; fakes e.g. `…teardown.security.test.ts:59` | One integration test against a real (test) DB proving rows cascade | days |
| **C-2** | Accumulating never-retired "legacy" dual-read fallback branches (permanent branch debt) | LOW | `byok-encryption.ts:16,102`; `account.ts:533-568`; `billing-service.ts:762-773`; `model-router.ts:127,458` | Schedule cleanup migrations once the paired migration is confirmed applied | days |
| **D-2** | `esbuild@0.21.5` — GHSA-67mh-4wv8-2f99 dev-server request leak (≤0.24.2). Build-tooling only, not prod runtime | LOW | lockfile `esbuild@0.21.5` (via tsup/vitest) | Bump `tsup`/`vitest` to pull esbuild `>=0.25` | hours |
| **D-3** | `@anthropic-ai/sdk@0.27.3` ~stale (no CVE) — maintenance flag | LOW | lockfile `@anthropic-ai/sdk@0.27.3` (declared `^0.27.0`) | Bump to current minor; verify no breaking changes | hours |
| **D-4** | `stripe@16.12.0` one major behind (money SDK, API-version drift) | LOW | lockfile `stripe@16.12.0` | Plan a controlled bump to the current major + Stripe API version | days |
| **D-5** | `highlight.js@10.7.3` EOL major (11.x current), no active CVE at this pin | LOW/INFO | lockfile `highlight.js@10.7.3` | Track for the react-syntax-highlighter replacement | hours |
| **E-7** | Non-money read paths swallow all errors silently (`/status`, card-info, confirm-plan) | LOW | `billing.ts:261`, `:315-317`, `:359-361`, `:398-400`, `:442-444` | Log at `warn` to surface Stripe/DB outages | hours |
| **C-3** | `void data; // suppress unused warning` smell | LOW | `startup-migrations.ts:35` | Remove or use the value | hours |
| **S-1** | **No secret ever committed to git history** (all 252 commits, all refs) | INFO✅ | see §2 | — (maintain discipline) | — |
| **C-1** | **Very low code debt**: 5 TODO/FIXME, 5 `as any`, 22 ts-ignore/eslint-disable, 0 orphan files | INFO✅ | see §4 | — | — |

---

## §1 · Dependency audit

**`pnpm audit` is UNGRADEABLE in this environment** — the npm advisory endpoint returns `HTTP 410` ("This endpoint is …"). `registry.npmjs.org` is on the proxy's `noProxy` allowlist, so this is npm's own legacy-endpoint sunset, not a proxy block. In lieu of an automated number, the assessment below is a **manual lockfile-vs-CVE reconciliation** of the resolved versions in `pnpm-lock.yaml`.

**Confirmed vulnerable / stale (resolved versions):**
- `prismjs@1.27.0` — pulled transitively by `react-syntax-highlighter@15.6.6 → refractor@3.6.0`. Affected by **CVE-2024-53382** (DOM Clobbering, fixed 1.30.0). This is a **live client surface**: `apps/web/components/project/file-viewer-modal.tsx:5` renders generated file content through `Prism`. A patched `prismjs@1.30.0` already resolves elsewhere in-tree (shiki path), so a `pnpm.overrides` bump is low-risk. **MED** (D-1).
- `esbuild@0.21.5` — **GHSA-67mh-4wv8-2f99** (dev server serves any origin, ≤0.24.2). Present only via `tsup`/`vitest` build-tooling; **not in the production runtime**. **LOW** (D-2).
- `@anthropic-ai/sdk@0.27.3`, `stripe@16.12.0`, `highlight.js@10.7.3` — stale majors/minors, **no known CVE at these pins**. Maintenance/API-drift flags, not vulnerabilities. **LOW** (D-3/D-4/D-5).

**Positive discipline (verified at patched floors):** `pnpm.overrides` pins `fast-uri>=3.1.2`, `ws>=8.20.1`, `brace-expansion>=5.0.6`, `fast-xml-parser` (resolved 5.7.1); and `form-data@4.0.5` (post CVE-2025-7783), `cross-spawn@7.0.6`, `nanoid@3.3.11`, `semver@6.3.1/7.7.4`, `postcss@8.4.31/8.5.10`, `cookie@1.1.1`, `word-wrap@1.2.5` are all at or above their advisory floors. This is above-median hygiene for a seed-stage repo.

**Licence scan — PARTIALLY UNGRADEABLE.** `node_modules` is not installed and no SBOM tool (`osv-scanner`/`trivy`/`grype`) is present, so a full **transitive** licence scan could not run. The **direct** dependency set (Next, React, Hono, Stripe, Supabase, AWS SDK S3, Octokit, Resend, Zod, Pino, bcrypt, web-push, jszip, unpdf, otpauth, qrcode, js-yaml, diff) is **entirely permissive (MIT / Apache-2.0 / ISC / BSD)** — no AGPL/GPL/copyleft in the direct tree. The repo's own `package.json` is `UNLICENSED` (proprietary), correct for a private product. The separate **third-party model white-labelling** (Kimi et al.) is tracked in `docs/MODEL_LICENSES.md` and is a product/IP matter, out of scope for npm-licence contamination — the strategic DD's L-3 already flags it.

---

## §2 · Secret hygiene (git history)

**Scanned, not assumed.** All 252 commits across **all refs** (`git log --all --source -p`) were pattern-scanned for `sk-…`, `sk_live_`, `AKIA…`, private-key blocks, `ghp_…`, `AIza…`, `xoxb-`, and JWTs. **Zero real secrets.** Every match is one of:
- a **placeholder** (`sk_test_your-stripe-secret-key`, `sk_test_dummy`),
- a **masked dashboard display value** (`· sk_live_••••••42` in an HTML mock),
- a **scrubber test-fixture** (`sk-ABCDEF1234567890ABCDEF1234`, asserted to be redacted),
- a **dev-guard string check** (`key.startsWith('sk_live_')` refusing to boot in dev mode).

Supporting controls verified: `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, and all environment variants with an explicit `!.env.example` allow; **no `.env` file was ever added** in history (`--diff-filter=A` returns nothing); and both `apps/api/.env.example` and `apps/web/.env.example` contain **only** placeholder comments (the secret lines are guidance like "Server-side wholesale key lives ONLY in Railway"). There is a live-key dev-guard (`load-env` refusing `sk_live_` when `GOBLIN_DEV_MODE=true`). **Clean — a genuine strength (S-1).**

---

## §3 · Test-reality on the money paths

Headline count: **~708 `it/test` blocks across 89 `*.test.ts` files** in `apps/api/src` (the "818" figure presumably rolls in e2e + prompt + shared suites). The distribution is **not** pathologically skewed to trivia — billing/publish/purge (~18 files) roughly equals the pure-unit/formatting bucket (~17). The problem is not *count*; it is *which assertions execute in CI* and *which failure modes are covered at all*.

**The load-bearing defect (T-1).** The strongest money and purge proofs are gated `const skip = HAS_TEST_KEY ? describe : describe.skip` (`change-plan.test.ts:125`, `change-plan-immediate.test.ts:98`, `account-deletion.test.ts:191`), and the CI `api-tests` job runs `pnpm --filter @goblin/api test` with **no `STRIPE_SECRET_KEY`** (`.env.test` is gitignored and absent). Therefore on every CI run `HAS_TEST_KEY===false` and these blocks are `describe.skip` — **0 assertions**. What silently does not run in CI: proration parity (`change-plan-immediate.test.ts:134`), the double-billing guard (`change-plan.test.ts:196`), the declined-card-leaves-sub-unchanged proof (`:142-161`), the first-charge subscribe path, price→tier mapping, and the deepest hard-delete completeness proof (`account-deletion.test.ts:253-287`).

**What genuinely runs and is well-asserted (credit where due):** webhook idempotency (`billing-webhook.test.ts:109-130`, asserts handler not re-invoked on duplicate + concurrent PK conflict), ack-fast/timeout surface (`stripe-webhook-processor.test.ts:88-109`), recovery replay that refuses to fabricate (`:113-145`), refund cents/cap correctness (`cancel-refund.test.ts:66-141`), and dunning idempotency (`dunning.test.ts:83-147`). These are meaningful, not shallow.

**Untested even outside the skip (T-2/T-3/T-4/T-5/T-6):**
- Deploy **content-match** branch never executes (mock forces `expectedEntry=null`; `deploy-verification.ts:82-85`).
- `purgeProjectStorage` verify-empty orphan-check (`file-storage.ts:583-625`) is mocked to `failed:[]` in all three deletion tests — the GDPR completeness guarantee is asserted nowhere.
- `routes/deploy.ts`, `vercel-service.ts` forward deploy, and `routes/billing.ts` subscribe/checkout endpoints have **no test files**.
- Price→tier mapping is verified only in the CI-skipped suite (`cancel-as-paid.test.ts:47` deliberately uses non-matching dummy ids and asserts state, not tier).

**The 5 least-covered critical paths, worst first:** (1) proration/plan-change correctness `billing-service.ts:428`,`:367` — CI-skipped; (2) first-charge subscribe `billing-service.ts:255` — CI-skipped; (3) storage-purge completeness `file-storage.ts:583-625` — mocked everywhere; (4) deploy content-match `deploy-verification.ts:82-85` — dead branch; (5) deploy route + Vercel forward API `routes/deploy.ts:50-143` / `vercel-service.ts` — no tests.

---

## §4 · TODO / FIXME / dead-code inventory

**Near-exemplary.** Non-test source contains **5 TODO/FIXME**, **5 `as any`**, **22 `@ts-ignore`/`@ts-expect-error`/`eslint-disable`**, **7 commented-out code-ish lines**, and **zero** `.bak`/`.old`/`.orig`/orphan files. The TODOs are scoped and tracked (`new-project-modal.tsx:55` `TODO(BUG-010 follow-up)`, `geo-pricing-section.tsx:50` single-source-of-truth note, `faq.tsx:1` `TODO(LP-3)`).

The one standing theme (C-2): **"legacy" dual-read fallback branches** — `byok-encryption` v1/v2 decrypt, `account.ts` F4.2-vs-legacy dual-write (`:533-568`), `billing-service` dahlia-vs-legacy invoice shape (`:762-773`), `model-router` legacy fall-through (`:127`). These are **deliberate** per methodology Law 4 ("Migrationen: authored, nie angewendet; Code pre-migration-tolerant") — not dead code. But they are **never retired** after the paired migration lands, so each migration permanently adds a fallback branch. It is tech-debt-by-design: low individual cost, monotonic accumulation. Recommend a "confirm-applied → delete-fallback" cleanup migration cadence. Minor smell: `startup-migrations.ts:35` `void data; // suppress unused warning` (C-3).

---

## §5 · Single-node assumptions (DD T-2/T-3 concretized)

Deployment confirmed single-process: `apps/api/railway.json` → `node`-served via `@hono/node-server` (`index.ts:274`), no `numReplicas`. **All three DD claims confirmed at `file:line`, plus additional anti-scale-out state the DD did not name:**

| State | Single-node? | Evidence | Breaks on scale-out (≥2 replicas) | Breaks at 100 concurrent (1 node) |
|-------|--------------|----------|-----------------------------------|-----------------------------------|
| Live-run registry | **YES** | `run-registry.ts:86` `new Map` | Live **Stop** returns false cross-replica (`:200-205`); re-attach needs sticky session | Unbounded heap: 100 handles × event rings (≤5000, `:79`) + mirrored file contents |
| Rate limits | **YES** | `rate-limit.ts:6` `new Map` (self-doc `:3-5`) | Per-replica counters → effective limit **×N** | Holds, but per-user only → no aggregate cap |
| Abuse cap (daily bytes) | **YES** | `abuse-caps.ts:36` `new Map` | Byte budget **×N** | Holds |
| Circuit breaker | **YES** | `circuit-breaker.ts:82` `new Map` | Independent per replica → one keeps hammering a dead provider | **3 failures rejects all 100 runs' calls to that provider** (`:13,30-37`) |
| Cache (TTL) | **YES** | `cache.ts:15` `new Map` | Plan/entitlement stale ≤5 min cross-replica (`:94`) | Fine |
| Cron | **YES** | `cron.ts:32` `setInterval`, gated `ENABLE_CRON` (`:19`) | **Double-fires** on >1 replica: dup digests, double hard-delete attempt | N/A |
| SSE / streaming | **YES (sticky)** | `run-registry.ts:248` in-proc bus, else 1s DB poll | Live tail/Stop need affinity or migration 0091 | 1 detached task + writer per run |

**Correctly DB-backed (disproves an over-broad reading):** login lockout (`login-lockout.ts:21` → `login_attempts` table) and soft daily quota (`soft-limits.ts:70,107` → `daily_request_counts` RPC). So the DD's "rate-limits not cross-replica" is **precise, not universal** — the fixed-window limiters are in-process; the auth/quota limiters are shared.

**F-40 "server-persisted, resume-able" — GRADED PARTIALLY TRUE.** View/history resume *is* DB-backed and survives restart/other replica (`run-store.ts:110-137` `findActiveRun` reads the DB; events persisted per-event to `agent_run_events` via `run-events.ts:72`, migration 0091). **But live execution + control are in-process only** — the `AbortController`, max-runtime timer, and Stop live in the `runs` Map; a restart leaves a `status='running'` zombie cleaned only by the staleness filter, and cross-replica Stop is a no-op. If migration 0091 is unapplied, the durable log no-ops (`run-events.ts:68,109`) and resume degrades to same-process-only.

**What breaks FIRST at 100 concurrent (ranked, N-6):** there is **no global admission control** (grep `p-limit`/`semaphore`/`maxConcurrent` → none; only per-user `hitRateLimit('agent-run', 30/h)` at `code-sessions.ts:646`). (1) **Upstream LLM + the shared breaker** — ~100 in-flight provider calls 429, then 3 failures OPEN the single breaker and reject all node runs to that provider, converting throttling into a full-node outage. (2) **Supabase single shared client + event-insert storm** (`lib/supabase.ts:6`; fire-and-forget insert per event `run-registry.ts:130`). (3) **Heap / event-loop pressure** from 100 event rings + mirrored project files held for the run + 120 s eviction grace.

---

## §6 · Error-handling sweep (money / publish paths)

**Confirmed FIXED (anti-pattern catalog stays honoured):** the "Webhook-200 erst nach Business-Logik" bug is refuted — `routes/billing.ts` verifies signature (`:466-479`), makes a durable idempotency claim (`:489-518`), returns 200 only after the claim, and runs business logic **fire-and-forget after the ack** (`void processStripeEvent(event)` `:551` → `return c.json({received:true})` `:553`). Idempotency is double-guarded (pre-check `SELECT` `:498` + unique-PK conflict `:519`) with a cron recovery sweep (`stripe-webhook-processor.ts:224-264`) that replays from the stored payload. `processStripeEvent` never rejects (`:175-213`). This is textbook-correct. Process-level `uncaughtException` (crash+restart) and `unhandledRejection` (log-only, deliberately non-crashing to protect concurrent streams) handlers both exist (`index.ts:257-269`).

**The systemic weakness is concentrated in the non-throwing "best-effort" tails on money/purge** — where "best-effort" + "job marked done" + "log only" = silent, unretried loss:
- **E-1 (CRIT):** cancel-refund result discarded (`billing-service.ts:748`); `failed`/`refunded_balance_unadjusted` never retried.
- **E-2 (HIGH):** balance-zero not idempotency-keyed (`:693-701` vs `:680`) → possible card-refund-plus-retained-credit.
- **E-3 (HIGH):** Vercel teardown warn-only then cascade + `completed` (`account-deletion.ts:506-556`) → permanent orphaned live site; contrast the correct blocking `throw` for storage purge (`:526-533`).
- **E-4 (MED):** charged-but-told-failed on subscribe/plan-change (`billing-service.ts:294-310`,`:469-478`) — data-consistent via webhook reconvergence, but UX-dishonest and a chargeback vector.
- **E-5 (MED):** `markDeployed(...).catch(()=>{})` (`agent/publish.ts:201`) drops URL persistence after `Live ✓`; the deploy route's DB write inside the outer try (`deploy.ts:160-163`) can report a genuinely-live site as `error`.
- **E-6 (MED/LOW):** synchronous money endpoints lack `withTimeout` budgets (bounded only by the Stripe SDK default), unlike the fully-wrapped webhook processor.

---

## Honest limitations (methodology §6.6 — mandatory)

1. **`pnpm audit` = HTTP 410** in this sandbox → no automated vuln count; §1 is a manual lockfile-vs-CVE reconciliation. A CI-side `pnpm audit` (or `osv-scanner`) against a live advisory DB would supersede it.
2. **Full transitive licence scan UNGRADEABLE** — `node_modules` not installed, no SBOM tool present. Only the *direct* dependency set (all permissive) was graded.
3. **DB FK cascade completeness on hard-delete UNGRADEABLE** at the unit layer — the fakes stub `supabase.auth.admin.deleteUser`, so no test proves the actual row cascade (T-6). Needs one integration test against a real test DB.
4. **Scale findings are static-analysis, not observed** — no load test was run (consistent with the DD's T-3; the only "performance" CI gate is a 400 KB frontend bundle budget in `performance.yml`, not concurrency). The "what breaks first at 100 concurrent" ranking (N-6) is reasoned from the code, not measured. **UNVERIFIED under real load.**
5. **`git` history scan is pattern-based**, not entropy-based — a high-entropy secret with no recognizable prefix could in principle evade it, though the placeholder-only result across 252 commits makes that low-probability.
6. Severities weigh *technical* exposure. Real-world impact of the money findings (E-1/E-2/E-3) is currently bounded by **zero external paying users** (strategic DD E-1) — they are pre-launch latent defects, and the launch cohort is exactly when they would first bite.

---

## Reconciliation with the strategic DD

The strategic DD's code-relevant findings hold up under source inspection, and the code half **adds two the outside pass could not see**:
- **T-2 (single-node)** → confirmed and made concrete (§5): registry `run-registry.ts:86`, rate-limit `rate-limit.ts:6`, no admission control.
- **T-3 (no load/DR test)** → confirmed; the only perf gate is a bundle-size budget.
- **NEW — the CI-skip (T-1)** → the "818 tests / e2e grün" headline is partly hollow on the money paths; a buyer discounts the green until the gated suites run in CI.
- **NEW — best-effort money/purge tails (E-1/E-2/E-3)** → silent refund loss and orphaned-deployment leakage under partial failure; not visible without reading the failure branches.

The strategic DD's central observation survives: **the buyer's remediation list and the founder's roadmap are largely the same document.** This audit extends that list with the CI-execution gap and the failure-tail hardening — both cheap (hours–days), both squarely inside the existing Wave discipline.

---
*Read-only audit. No product code was modified. This report is the sole artifact of the commit. Numeric evidence or UNGRADEABLE throughout — never a guess.*
