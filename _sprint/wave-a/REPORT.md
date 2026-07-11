# WAVE-A — Speed & Schönheit — sprint report

Branch `claude/wave-a-speed-design-rm1wby` from `origin/master` (75131b6, post WAVE-J).
Cloud session: work on a branch, open a PR, **HALT** — merge is founder-granted. No direct
merge, no local stack. Evidence in `_sprint/wave-a/`.

## Phase 0 — repo-state findings (STATE-FIRST; repo trusted over prompt)

1. **`docs/OPUS_OPERATING_SYSTEM.md` is ABSENT** and no founder package is attached to this
   cloud session to commit it from. Proceeded on the HARD RULES echoed in the prompt
   (isolated commits, evidenced gates, migrations authored-only, ledger same-commit,
   feeling invariants, test accounts, no false claims). **Founder action:** add the file to
   the repo so future Runbook-2 waves can read it.
2. **`docs/GOBLIN_FEEL3_ARCH.md` is ABSENT.** Read the live code (orchestrator, prompts,
   run-store, publish/verify) directly instead; architecture understood from source.
3. **Top rider already done:** `agent_run_started` (twin of `agent_run_finished`) is already
   emitted in master (`code-sessions.ts:606`, WAVE-J rider commit 780f91c). No action — noted.
4. **A-5 push infra largely pre-existed:** `push_subscriptions` (migs 0012/0015), `sw.js`
   push handler, `usePushNotifications`, the `/api/notifications` route + `sendPushNotification`,
   and `notify_*` columns (0048) all shipped already. A-5 was therefore **wiring**, not a
   from-scratch build (see A-5).
5. **Evidence dir:** repo convention is `_sprint/<wave>/` (wave-i, wave-j). Used that (the
   cloud header's `evidence/<wave>/` and the prompt's `_sprint/wave-a/` conflicted; trusted
   the repo).

## Unit-by-unit

| Unit | Commit | Status | Gate |
|---|---|---|---|
| A-1 TTFT prefix caching | `d475c1d` | ✅ built | prefix-stability test green; TTFT numbers = founder SQL (no prod DB) |
| A-2 Design foundation | `64641ee` | ✅ built | before/after gen screenshots **BLOCKED** (needs model key) |
| A-4 Plan mode | `1bf3df3` | ✅ built | ✅ orchestrator tests (complex→plan, trivial→none) |
| A-6 Stop-report fix | `1e9f58f` | ✅ built | ✅ run-store persistence tests; live E2E is founder-runnable |
| A-5 Push + JIT | `31f30dd` | ✅ built (wiring) | ✅ notify unit tests; live desktop-Chrome + iOS **BLOCKED-pending-env** (VAPID) |
| Rider: drop memory placebo | `56b8617` | ✅ built | ✅ tsc; migration 0089 authored |
| Rider: real push toggle | `adafdcf` | ✅ built | ✅ tsc |
| A-3 Runtime smoke | `086f879` | ⛔ **HALT** (spike) | gate needs JS execution → escalation; decision table delivered |

### A-1 — TTFT: measure, then cache-structure
- Verified DeepInfra prompt caching is **automatic + prefix-based** (no opt-in param;
  optional `prompt_cache_key` raises hit rate) — [docs.deepinfra.com/chat/prompt-caching].
- Restructured `buildAgentSystemPrompt` around `AGENT_STATIC_PREFIX` (identity + tool docs +
  few-shots, byte-stable) FIRST; dynamic project/user tail LAST. Wired `prompt_cache_key`
  per tier on the agent model turn.
- **Deterministic prefix-stability** proof: `prefix-stability.test.ts` asserts the static
  prefix is byte-identical across two renders with maximally-different dynamic context (the
  cache-hit precondition), and that no per-run value leaks into the prefix.
- **Numbers:** cloud session cannot reach the prod DB → `A1_TTFT_FOUNDER_SQL.sql` gives the
  founder-runnable p50/p90-per-surface before/after queries. **No prompt-content regression:**
  the identity + ABSOLUTE-rule probes in `goblin-agent-system.test.ts` still pass.

### A-2 — Generated-app design foundation
- `prompts/app-design-foundation.ts` (**~800 tokens, measured** — under the 1.5k budget):
  system font stack + ≤1 Google font, 4px spacing scale, centered max-width, harmonious
  dark-mode-aware palette via CSS vars, button/input baseline, mobile-first meta, no external
  CSS framework by default. Scoped to the **generated app** (defers to the user's own design),
  injected into the A-1 cache-warm static prefix, absent from base chat (tests assert all of
  this).
- **BLOCKED:** the before/after "Baue einen Habit-Tracker…" screenshots need a real model
  generation (no goblin-hosted key in this session). **Founder repro:** run that prompt in an
  agent run before/after and screenshot both at 375px.

### A-4 — Plan mode
- Control-flow `plan` tool intercepted by the orchestrator (no service call): emits a
  **distinct `agent_plan` step**, logs it, and continues immediately — **announce-then-act,
  NO approval wait** — never terminating or burning a heal cycle, emitted at most once.
  Few-shot pair (complex→plan-first, trivial→direct) in the static prefix. Client renders the
  plan as its own block. `plan-mode.test.ts` proves plan-on-complex / none-on-trivial.

### A-6 — Stop-report fix
- Root cause: the `agent_report` SSE frame is lost when a client abort closes the stream.
  Server now persists the report card (`agent_runs.report`, mig 0088 authored) via a 3-tier
  pre-migration-tolerant finalize; new ownership-scoped `GET …/runs/:runId/report` (204 when
  not yet written — never fabricated). Client captures the run id from `meta` and, after an
  abort with no report, re-fetches with a bounded retry (races the server finalize) and
  renders the card.

### A-5 — Push notification: "dein Ping vom Strand"
- Wired the **existing** web-push stack to agent runs: `notifyAgentRunFinished` pushes the
  outcome, or on a verified publish "Deine App ist live ✓" with the **truth-gated** URL
  (never invented). Gated by `notify_build_complete`, fire-and-forget, **key-agnostic**
  (no VAPID/subscription → silent no-op). JIT ask after the first long run. Fixed the
  Personalisierung→users prefs table read. `notifications.test.ts` proves gating + honest
  content variants (incl. error → "nichts kaputt", not a success claim).
- **BLOCKED-pending-env:** live desktop-Chrome subscribe→run→receive needs VAPID keys, which
  **must not transit this session**. Founder setup + honest support matrix in
  `A5_PUSH_FOUNDER_SETUP.md`. iOS PWA push = founder acceptance item.
- **Silent degradation while VAPID env absent — CONFIRMED (code-verified):** with
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` unset the push wiring is a **no-op, never a crash
  and never a false "sent"**:
  - `notifications.ts:20` — `webpush.setVapidDetails` is called ONLY when both keys exist.
  - `notifyAgentRunFinished` (`:232`) returns immediately if either key is absent; the whole
    body is wrapped in try/catch (`:265`) and the route invokes it fire-and-forget
    (`void notifyAgentRunFinished(...)`), so a run finish is unaffected either way.
  - `sendPushNotification` (`:274`) logs one warn and returns; `/test` + `/send` return a
    clean 500 "not configured" rather than throwing.
  - Client `usePushNotifications.subscribe` (`usePushNotifications.ts:57`) logs and returns
    when `NEXT_PUBLIC_VAPID_KEY` is unset — no throw; the settings toggle wraps it in
    try/finally so the UI never breaks. The `notify_build_complete` toggle still persists.
  Net: keys absent → nothing is sent, nothing errors; keys present → sends resume with no
  code change.

### Settings riders (founder-ratified)
- **Remove `memory_enabled` placebo:** confirmed it was stored/returned but **never read to
  gate anything** (the rolling project memory runs regardless). Removed from the API surface
  + Personalisierung UI; migration 0089 drops the dead column (authored).
- **Real push toggle:** the Benachrichtigungen toggle now creates/removes an **actual**
  web-push subscription (the row A-5 reads), not just a permission prompt.

### A-3 — Runtime smoke (HALT)
- Spike delivered (`A3_RUNTIME_SMOKE_SPIKE.md`). The gate ("deliberate console error → smoke
  catches it") requires **JS execution**; only Playwright-in-Railway (a) or an external
  headless vendor (b) provide it — (a)'s Railway runtime is **unverifiable from this cloud
  sandbox**, (b) is a new paid vendor (against the no-new-paid-services law). The fetch-based
  reachability floor already ships via `verifyDeployment`. **HALT with recommendation:** async
  Playwright job, founder-greenlit, de-risked on Railway first.

## Self-review checklist
- **Isolated commits:** 8 commits, one unit each, individually revertable. ✅
- **Evidenced gates:** unit tests for A-1/A-4/A-5/A-6 + prompt probes for A-1/A-2; BLOCKED
  gates named honestly with the exact founder repro. ✅
- **Migrations authored-only:** 0088 (agent_runs.report), 0089 (drop memory_enabled). Neither
  applied; both idempotent + the API writes are pre-migration tolerant. ✅
- **Ledger same-commit:** WAVE-A NOTE added in the A-2 commit (consumption-relevant). ✅
- **Feeling invariants:** no invented live URLs (publish truth-gate only), honest failure
  copy, announce-then-act plan (no fake approval), no false "done". ✅
- **No new paid services.** ✅ (A-3 rejected the vendor path.)
- **German UI + EN i18n:** all new UI strings via `t(lang, de, en)`. ✅
- **Suites green:** 514 API tests pass (16 skipped); `tsc --noEmit` clean for api + web. ✅

## Migrations (founder applies via Supabase SQL Editor)
- `0088_agent_run_report.sql` — `agent_runs.report jsonb` (A-6).
- `0089_drop_memory_enabled_placebo.sql` — drops `users.memory_enabled` (settings rider).

## Honest limitations
1. **A-1 TTFT numbers** are not measured here — no prod DB from cloud. Founder runs
   `A1_TTFT_FOUNDER_SQL.sql` before/after (~24 h apart).
2. **A-2 before/after screenshots BLOCKED** — no model key in-session. Founder eyeballs the
   before/after generation.
3. **A-5 live push BLOCKED-pending-env** — VAPID keys must not transit this session; the send
   path is proven by unit test but not end-to-end here. iOS = acceptance item.
4. **A-3 HALTED** — no runtime smoke shipped; only the spike + recommendation. Founder decides
   the infra path.
5. **No headless screenshots** — external-URL headless is a known proxy limitation in this
   sandbox, and there was no model key to produce real agent output to shoot. DOM/behaviour is
   covered by the unit tests instead.
6. **OPUS_OPERATING_SYSTEM.md / GOBLIN_FEEL3_ARCH.md absent** — proceeded on the prompt's
   HARD RULES + live code.

## Founder action list
1. Apply migrations **0088** then **0089** (Supabase SQL Editor).
2. Generate VAPID keys + set the Railway/Vercel vars (see `A5_PUSH_FOUNDER_SETUP.md`), then
   run the desktop-Chrome subscribe→run→receive gate; accept/park iOS PWA push.
3. Run the A-2 before/after generation ("Baue einen Habit-Tracker…") and eyeball at 375px.
4. After ~24 h of prod traffic, run `A1_TTFT_FOUNDER_SQL.sql` for the before/after TTFT.
5. Decide the A-3 runtime-smoke path (recommended: async Playwright, de-risked on Railway).
6. Add `docs/OPUS_OPERATING_SYSTEM.md` to the repo.
7. Review + merge the PR (merge is founder-granted).
