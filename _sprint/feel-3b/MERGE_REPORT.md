# FEEL-3b — Merge report (the hand on the button)

**Merge SHA:** `a9e2fd5` (`Merge feel-3b: FEEL-3b — the hand on the button …`) · **Branch:** feel-3b → master · **Date:** 2026-07-07

## What shipped

The publish half of the agent loop (spec §3/§5), 6 isolated commits:

| Commit | Unit |
|---|---|
| `ed2483c` | **B1** — `publish` + `read_deploy_status` tools over the P0.2 truth-gate |
| `21605e2` | **B2** — explicit-intent gate (D1) + confirmation chip |
| `c9cf7c5` | **B3** — bounded self-heal (max 2 corrective cycles → honest finish) |
| `1d9320a` | **B4** — agent-mode prompt + report card (verified-Live / chip / honest-failure) |
| `3cc62b7` | **B5** — real-model + real-Vercel gates (evidence) |
| `9145d11` | **B5-fix** — mixed-mode guard (one tool-call signal per turn) |
| `7f5ee00` | **B5** — post-guard W10 re-measurement (evidence) |

## Gates

- **Suites:** full API suite **423/423 green**; agent suite 56/56 (intent 5, publish 9, orchestrator 14, prompt 11, tools 9, run-store 5, config 5). Web + API `tsc --noEmit` clean.
- **Ledger:** M10 updated (publish/self-heal turns folded into the per-run formula) in the B1 commit.

## B5 — real Goblin Swift + real Vercel (test account's own token)

- **Run 1** (build + "stell sie live"): PASS — 0 taps → `feel3b-b5-32305.vercel.app`.
- **Run 2** (edit, no signal → chip → tap): PASS — chip offered, publish-only resume → "Kaffee oder Tee?" live.
- **Run 3** (broken-asset fixture): PASS — model resolved the missing asset → green.
- **Run 4 — W10 canonical** ("… und sag mir wenn es live ist"): **4/5 clean** (pre-guard obs-1 was an honest failure from the model dropping a file via protocol-mixing → fixed by the mixed-mode guard; obs-2 + 3× post-guard all published + verified). **Interactions after send: 0 on every run.** The real W10 number is **0**.

## Prod verification (SHA a9e2fd5)

- **Both `/api/version` on `a9e2fd5`:** API `goblinapi-production.up.railway.app` ✓, web `goblin-web.vercel.app` ✓.
- **Prod smoke** — one real prod agent run, explicit intent (run-1 message): **published**, verified `https://feel3b-b5-23901.vercel.app` (HTTP 200, `<title>Mini-Umfrage</title>`, localStorage), **0 interactions**.
- **Non-goblin model unchanged:** prod `POST …/agent` with `llama-3.3-70b-versatile` → **409 `agent_not_eligible` (model_not_eligible)** — classic path intact.

## Honesty note

Every failure path stayed honest: no run ever claimed "Live" without a green `publish` truth-gate. The one W10 pre-guard failure ended in an explicit honest-failure report, never a false success. Broader JSON-fallback hardening (the deeper cause of protocol-mixing) remains **FEEL-3c** scope, as agreed.

## Founder gate (runbook)

Per the sprint: **your own phone, production, the W10 message — feel it before pasting FEEL-3c.**
