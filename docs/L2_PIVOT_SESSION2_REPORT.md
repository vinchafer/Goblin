# L2 API-First — Session 2 Report (Go-Live)

**Date:** 2026-06-16 · **Branch:** `l2-api-first-pivot` → merged to `master`
(`c279783`) · **Flag:** `GOBLIN_HOSTED_API` — **ON in prod** (Railway + Vercel).

Layer 2 (Goblin-bundled models) is **live** on a US wholesale provider (DeepInfra),
proven end-to-end against a deterministic mock (Stage A) and 4 real calls (Stage B).

---

## What went live

- **Provider:** DeepInfra (OpenAI-compatible). Key in Railway env `DEEPINFRA_API_KEY`
  only; base URL defaults to `https://api.deepinfra.com/v1/openai`.
- **Tiers:** Goblin **Swift** → `deepseek-ai/DeepSeek-V3.2` (default; trial + all paid
  plans). Goblin **Forge** → `moonshotai/Kimi-K2.6` (Pro/Power). Slugs env-overridable.
- **Fail-closed invariant:** config returns `null` (Layer 2 stays off) if any tier
  maps to a Google/Anthropic/OpenAI model — the zero-retention story can't be broken
  by a config slip.
- **Two-level truth:** the wholesale provider slug travels only on the wire
  (`RouteResult.apiModel`); the browser and DB only ever see the tier id
  (`goblin/efficient`). Verified live — no `deepseek`/`deepinfra`/`kimi` leak in any
  streamed event.
- **Guards:** per-request 8096-token ceiling; per-user **5M-token/day** drain guard
  (same-day `completion_costs` sum, no migration). Plus the monthly fair-use cap.
- **Cap:** `/api/users/me/usage` returns `goblinCap` from the mig-0067 rollup;
  `GoblinUsageBar` renders it on the Usage page. `/health/deep` reports
  `goblin_hosted` state.

## Stage A — exhaustive mock matrix (38 tests, all green)

`apps/api/src/services/goblin-hosted.test.ts`. Deterministic mock behind the real
`GoblinChatClient` interface + a stubbed Supabase. Covers: tier→model resolution,
fail-closed invariant, plan-gating, cap thresholds, all injected errors
(timeout/429/5xx/402/malformed → calm on-brand messages, never a raw trace),
per-day drain guard (provider never reached), two-level truth, flag-off safety.

### FIXES log (Stage A)
1. **Test expected an event, code threw.** Plan-gating + no-model refusals throw
   from `resolveModel` (outside `streamCompletion`'s try). Confirmed the production
   path (`streamCompletionGuarded`, used by the chat route) converts that throw into
   a graceful `{type:'error'}` event → retargeted the two tests to the guarded path.
   Not a code change — a test that proved the real UX is graceful, not a crash.

## Stage B — real DeepInfra reality check (4 calls, ~502 tokens, ≈ $0.001)

Driven server-to-server through **prod** (`audit/stage-b-deepinfra.mjs`) as a test
user — the script never holds the key; prod makes the inference call.

| Call | Tier → model | tokens in/out | result |
|---|---|---|---|
| Swift | DeepSeek V3.2 | 16 / 19 | real reply, no slug leak |
| Swift (cap-mover) | DeepSeek V3.2 | 57 / 2 | cap counter moved 0 → 94 live |
| Forge (trial) | — | — | **correctly refused** (plan-gate proven live) |
| Forge (Pro) | Kimi K2.6 | 17 / 297 | real reply, no slug leak |

- **Cap aggregation works live**: the mig-0067 rollup incremented after each Swift
  call. Plan-gating, two-level truth, and guards all behaved exactly as the mock.
- **Spend:** ~502 tokens total ≈ **$0.001** (est). The **$10 balance is intact** for
  the founder's own walk. Confirm exact charge on the DeepInfra dashboard.

### FIXES log (Stage B → divergence from mock)
1. **Trial users were refused the default Swift tier.** Real test account plan is
   `trial`, which was in no tier's plan list → Swift (the "no key, just build" wedge)
   was refused. **Fix:** add `trial` to Swift's plans (Forge stays Pro/Power); spend
   is bounded by the cap + daily guard, so there's no margin reason to lock trials
   out. Free/missing plans remain excluded (they get the free pool, not Layer 2).
2. **Refusal copy was wrong for Swift** — it hardcoded "Pro and Power" + "or pick
   Goblin Swift" even when Swift was the refused tier. **Fix:** tier-aware copy.
   Re-ran Stage A (added a trial-Swift streaming test) → green, redeployed, re-verified
   live (Swift now streams on the trial account; Forge still gated).

## Calibration defaults (Phase 7)

- **Tier metadata:** Swift = "fast, light, no key required" (default); Forge =
  "stronger, for heavier work" (Pro/Power). Names/descriptions consistent API↔web.
- **Monthly soft caps** (tokens): Build 40M · Pro 120M · Power 250M; **warn at 80%**.
  Sourced from the financial model's heavy-tail analysis (base ~40–60M/mo). Provisional
  — revisit once real telemetry lands; the shape (build < pro < power) is the point.
- **Per-day guard:** 5M tokens/user. **Per-request:** 8096 output tokens.
- **GoblinUsageBar** states (empty/normal/warn/over) are on-brand at 390px: green
  track fill, gold only as a filled surface on warn/over, mono numbers, no gold
  borders, no emojis. Error/empty/loading copy is calm and plain-spoken (EN/DE).
- **Note from real data:** Forge (Kimi) can be verbose (297 out tokens for a 3-word
  answer) — output-token cost is the variable to watch; the token cap already governs it.

## Policy / compliance surfaces updated (HR-4)

- **Privacy policy** (`app/(legal)/privacy/page.tsx`): DeepInfra added as a **US
  sub-processor** (SOC2/ISO, zero-retention OSS, **SCCs**); new "AI Processing &
  International Transfers" section (US inference, EU storage B2 eu-central-003, no
  overclaim); sub-processor list corrected (Backblaze/Railway/Resend; Anthropic/OpenAI
  framed as BYOK).
- **Landing FAQs** (×2): stale "Hetzner Frankfurt" → "EU"; no inference-location claim,
  no provider name.
- **Arch doc** `Architektur/GOBLIN_ARCH_v6.md` §Layer-2 Inference Sourcing: "EU endpoint
  preferred" → DeepInfra US under SCCs, EU storage, Railway secret.
- **Activation guide** + `.env.example` + `index.ts`: `DEEPINFRA_API_KEY`, DeepInfra
  defaults, fail-closed note.
- No surviving EU-only-inference claim. No live EU-AI-Act inference-location claim
  existed. Provider name appears only on the legal sub-processor surface (HR-6).

## Founder iPhone verification checklist (390px)

1. Open the Model Hub → see **Goblin Swift** + **Goblin Forge** (no provider name).
2. Run a build with **Swift** → it streams a real reply.
3. Settings → Usage → the **Goblin-Modelle** bar moves after the run.
4. Run a build with **Forge** on a Pro/Power account → streams; on a trial/Build
   account → cleanly refused with the upgrade message (not a crash).
5. Confirm **BYOK** (connect your own key) and the **free pool** "Coming Soon" badge
   are unaffected.

## State

- Tests: **api 132/132**, api+web tsc clean. Key absent from tree. DeepInfra absent
  from all marketing surfaces (privacy page only). EN/DE parity on new strings.
- Pushed to `master`: `c45932c` (go-live) + `c279783` (Stage-B gating fix). Prod
  deployed and verified live.
- DeepInfra balance: **~$10 remaining** (Stage B spent ≈ $0.001).

## Deferred

- Full cap calibration once real usage telemetry accrues (current numbers are sane
  launch defaults, not measured).
- Forge cost calibration (Kimi output verbosity) once volume data exists.
- Privacy page is EN-only (no DE mechanism on that route) — matches prior state.
- Goblin-hosted per-completion **cost** in `completion_costs` is $0 (model-pricing has
  no `goblin/*` entry) — token tracking (what the cap needs) is correct; add real
  pricing entries when COGS calibration starts.
