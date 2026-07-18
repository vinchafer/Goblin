# WAVE-B — Merge Report (Full-Stack: Apps mit Datenbank & Login)
**Branch `wave-b-build` · base `origin/master` @ 4e9148c · Opus · 2026-07-18**
**Founder decisions:** D-B1 = **Supabase, user-connected** · D-B2 = **2 backends/trial** · Provider scope v1 = **Supabase only** (provider-agnostic by design).

## Context (3 lines)
Wave B is the category jump: the agent builds apps with **real persistence + login**, entered via Spike → Founder-Gate → Build. Session 1 produced the decision table; the founder chose Supabase user-connected (backend lives in the user's own account → $0 platform COGS, own-Vercel model). This session built B1–B4 key-agnostically (no secret ever in-session) behind an opt-in flag, additive to the live static + framework paths.

## Per-unit table
| Unit | Commit | What | Gate evidence | Status |
|---|---|---|---|---|
| Spec (Phase-0 gap) | `fcb1fe2` | Committed founder's `GOBLIN_FULLSTACK_SPEC.md` (never landed) | Phase-0 re-run: 3/3 docs present | ✅ |
| Spike (Session 1) | `b955f6a` | Decision table, recommendation, D-B1/D-B2, M-row, CFO row | `_sprint/wave-b/SPIKE_DECISION_TABLE.md` (every number URL+date) | ✅ |
| **B1** connector & provisioning | `dc5080a` | provision_backend tool (idempotent, attested, never throws), RLS-always generator, OAuth connector, byok storage, trial cap D-B2, FW6 teardown, migration 0096, ledger M15 | 24 fullstack tests; account-deletion suites green with teardown | ✅ |
| **B2** agent capability | `041f82f` | Capability map + schema→RLS→client-wiring few-shots (conditional block; prefix stays byte-stable), tool gating | 5 capability tests + prefix-stability green | ✅ |
| **B3** the proof | `abfd099` | Deterministic proof path + reference app + adversarial RLS probe + runtime smoke + PROOF.md | 6 proof tests; `evidence/wave-b/` | ✅ (live run founder-gated) |
| **B4** honest edges | `b722a22` | Connectors page Supabase row, idle-pause + trial-cap copy DE+EN, docs/FULLSTACK.md | web tsc clean | ✅ |

## Numeric acceptance
- **New tests: 35** (24 B1 fullstack + 5 B2 capability + 6 B3 proof).
- **Full API suite: 978 passed / 0 failed** (114 files). Baseline (967) + 11 net new that run in-suite.
- **Money suites: unchanged 17/17** — account-deletion (6) + change-plan (7) + change-plan-immediate (3) + guard (1), all green against real test-mode Stripe.
- **tsc clean:** api ✓ · web ✓ · shared ✓.

## Per-claim evidence
| Claim | Status | Evidence |
|---|---|---|
| Provisioning attested (never fabricated), latency measured | VERIFIED | `supabase-provider.test.ts` (8) |
| Tool idempotent, never throws, JIT signal, trial cap, no service_role leak | VERIFIED | `provision-tool.test.ts` (10) |
| **RLS ALWAYS generated with every table** | VERIFIED | `schema-sql.test.ts` (6) + `wave-b-proof.test.ts` |
| Capability block present only when enabled; static prefix byte-stable | VERIFIED | `wave-b-provision-capability.test.ts` (5) + `prefix-stability.test.ts` |
| Teardown wired into FW6 blocking purge (GDPR) | VERIFIED | `account-deletion*.test.ts` green with new block |
| Flag-off → existing static + framework runs byte-identical | VERIFIED | tool-gating test (provision absent) + prefix-stability + 967 prior tests unchanged |
| service_role / client_secret never in tool result, code, logs | VERIFIED | proof test (no secret in result); scrub-secrets env vars added; anon key is public by design |
| **Live: real backend provisioned + published, A cannot read B's rows, smoke green** | FOUNDER ACTION | `evidence/wave-b/PROOF.md` steps (prod test account) |

## Self-review checklist (OPUS_OS §3)
1. **Evidence audit:** every referenced test re-run and green; PROOF.md claims map to real test names; the one un-run claim (live provisioning) is explicitly marked FOUNDER-ACTION, not claimed. ✓
2. **Diffstat vs scope:** 31 files, every one justified by a unit (see per-unit table); consumption path = M15 (ledger, same commit as B1). ✓
3. **Regression:** flag-off byte-identical proven (gating test + prefix-stability); full prior suite (967) unchanged; account-deletion (money-adjacent) still 17/17. ✓
4. **Honesty sweep:** new strings DE+EN; latency is MEASURED (no fake "~X Sekunden"); idle-pause/trial copy honest; no English leak in DE, no self-label, no phantom affordance (Supabase row honest-hides to "Bald" when the flag is off). ✓
5. **Ledger:** M15 present in the B1 commit (M12 was taken → state-first). ✓
6. **Report completeness:** SHAs, per-unit evidence, Honest-Limitations, Founder actions, numeric figures below. ✓
7. **Steven question:** a skeptic seeing only this evidence reaches the same verdict — the mechanism is proven, the live run is honestly deferred to the founder gate. ✓

## Migrations (authored, never applied — Law 4)
- `supabase/migrations/0096_fullstack_supabase_backends.sql` (next free ≥0096) — widens the byok_keys provider CHECK to allow `supabase`; creates `supabase_backends` (registry + RLS). **Founder applies** via the Supabase SQL Editor. Every API path is pre-0096 tolerant (feature-detect → honest degrade), so master is safe before it is applied.

## Honest limitations
- **The one live proof is founder-gated** and was neither run nor faked here (it creates a real backend + publishes to prod). Deterministic mechanism + the probe's logic are proven; the two-real-user live RLS denial + runtime smoke are the founder's step (PROOF.md).
- **Provisioning latency is UNVERIFIED as a figure** — the spike found no official number; the tool MEASURES it at runtime (`supabase_backends.provision_latency_ms`) and surfaces the real value. None invented.
- **SQL-application endpoint** (`POST /v1/projects/{ref}/database/query`) is used for schema apply; its exact live behavior is confirmed in founder-gate step 3 (the reference page exists; not exercised against a live project in-session).
- **Partial-provision orphan window:** if the record-row write fails *after* a backend is genuinely live, the backend works but is untracked for teardown — logged loud (never silent). Created-but-unfinished provisions ARE recorded `failed` (reapable). No known silent half-state.
- **No web component-render test** for the connectors row — the repo tests web at lib level only; the row mirrors the (working) Vercel/GitHub patterns and typechecks clean.

## Founder actions
1. **Register a Supabase OAuth app** (Supabase Dashboard → Organization → *OAuth Apps* → *Register application*). Redirect URL must be **exactly** `https://<api-host>/api/supabase/callback` (the value `supabaseOAuthRedirectUri()` builds; set `SUPABASE_OAUTH_REDIRECT_URI_RAILWAY` if the host differs). → yields `client_id` + `client_secret`.
2. **Set Railway env vars** (API service) — set directly in Railway, never in a session:
   - `SUPABASE_OAUTH_CLIENT_ID_RAILWAY` = the OAuth app client id
   - `SUPABASE_OAUTH_CLIENT_SECRET_RAILWAY` = the OAuth app client secret
   - `SUPABASE_OAUTH_REDIRECT_URI_RAILWAY` = `https://<api-host>/api/supabase/callback`
   - `GOBLIN_FULLSTACK_DEFAULT_REGION` = `eu-central-1` (Frankfurt)
   - `GOBLIN_FULLSTACK_ENABLED` = `true` (the master opt-in — leave unset/false to keep the feature dark)
3. **Apply migration** `0096_fullstack_supabase_backends.sql` via the Supabase SQL Editor.
4. **Run the ONE live full-stack proof** on the prod test account `vinc.hafner3@gmail.com`, D-B2-respecting: connect one Supabase account, send the verbatim task, then run `evidence/wave-b/rls-probe.mjs` (expect PASS) + `evidence/wave-b/runtime-smoke.mjs` (expect ok:true). Steps: `evidence/wave-b/PROOF.md`.
5. **Ledger/CFO:** M15 is in the ledger (drafts only). The CFO assumption-row text is in `_sprint/wave-b/SPIKE_DECISION_TABLE.md §5` — apply to the dashboard yourself (I do not edit it): platform COGS per provisioned backend = **$0** (user-connected).

## CI ground truth
Locally (this session): api tsc ✓, web tsc ✓, shared tsc ✓; full API suite 978/978; money suite 17/17 (real test-mode Stripe). CI parity expected — the `api-tests` job runs the same vitest suite with the Stripe secrets that arm the money-suite guard.

**PR opened. HALT — merge founder-granted.**
