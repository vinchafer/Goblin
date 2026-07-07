# FEEL-3b B5 — Swift gates + W10 acceptance (real model, local stack)

**Date:** 2026-07-07 · **Stack:** API :3001 (`GOBLIN_DEV_MODE=false`, `GOBLIN_HOSTED_API=true`, real DeepInfra) · Goblin Swift (`goblin/efficient`) · real Vercel deploys under the test account's own token (`vinc.hafner3@gmail.com`) · driven over HTTP through `POST /api/code-sessions/:id/agent` (one POST = the message; the loop runs autonomously — so "interactions after send" = 0 structurally, and the chip case = 1 tap).

Each run used a **fresh project chat** (a new `code_sessions` row). Transcripts in `B5_run{1..4}/`.

## Verdicts

| Run | Message | Expected | Result | Verified URL |
|---|---|---|---|---|
| 1 | "Baue eine Mini-Umfrage-Seite … und **stell sie live**." | drafts → save → publish → verified, 0 taps | **PASS** — list_files → 3× write_file → save_draft → publish → **published**, 0 taps | `feel3b-b5-32305.vercel.app` (HTTP 200, `<title>Mini-Umfrage</title>`) |
| 2 | "Ändere die Frage auf \"Kaffee oder Tee?\"" (no publish signal) → then **chip tap** | edit → draft + chip; tap → published | **PASS** — edit → `draft-saved` + `confirm-publish` chip (model did NOT publish); chip tap (confirmPublish) → publish-only run → **published** | `feel3b-b5-32305.vercel.app` now serves "Kaffee oder Tee?" |
| 3 | broken-asset fixture (index.html → missing styles.css) + "**Stell die Seite live.**" | self-heal cycle → green (or honest failure) | **PASS** — model read index.html, saw the missing styles.css ref, created it, published → **green** (healCycles=0; proactive fix) | `feel3b-b5-broken-73478.vercel.app` (index + styles.css both HTTP 200) |
| 4 | **W10 canonical:** "Füge eine Einstellungs-Seite mit Dark-Mode-Umschalter hinzu … und **sag mir wenn es live ist**." | 0 interactions → verified URL | **FLAKY — 1 honest-failure / 1 PASS** (see below) | obs-2: `feel3b-b5-96476.vercel.app` (HTTP 200, dark-mode toggle + localStorage) |

## W10 acceptance — the real number

**Interactions after send: 0** (both observations — the run is fully server-driven; even the failure required no taps).

- **Observation 1 — honest failure.** The model emitted the `index.html` write as a *fenced `tool_call` in its prose* while making a **native** `styles.css` tool_call in the **same turn**. The orchestrator (correctly) executes the native call and ignores the prose fence → `index.html` never landed. Every publish 404'd (no entry HTML) → truth-gate red → **bounded self-heal ran its 2 cycles → forced honest finish** (`outcome=error`, "Nach 2 Korrekturversuchen weiterhin fehlgeschlagen: … HTTP 404"). **No false "live" was ever claimed** — the honesty invariants held perfectly.
- **Observation 2 — PASS.** Same message, fresh chat: model wrote `index.html` natively first, all 3 files landed, `save_draft` → `publish` → **verified live** dark-mode settings page at 0 taps.

**Root cause of the flake:** the Swift model occasionally mixes the native tool-call channel with a prose `tool_call` fence in one turn, dropping the prose call. This is exactly **FEEL-3c's stated scope — "JSON-protocol fallback hardening across the verified-model list."** It is a model-protocol robustness gap, **not** a defect in the B1–B4 publish/intent/self-heal code (runs 1–3 and W10 obs-2 exercise all of it cleanly).

## Unit / integration coverage (deterministic, green)

- `intent.test.ts` (5) — D1 matrix: explicit / absent / ambiguous ×2, DE+EN, Umlaut/diacritic-robust.
- `publish.test.ts` (9) — green gate → verified URL; missing-asset → structured failure naming the asset; saves before deploy; NO_VERCEL_TOKEN → honest failure; read_deploy_status verbatim.
- `orchestrator.test.ts` (12) — incl. B2 gate (granted → published; denied → chip, publish never executes) and **B3 self-heal (fixable → 1 cycle → green; unfixable → 2 cycles → honest failure; exact cycle count in step log)**.
- `goblin-agent-system.test.ts` (11) — prompt: 7 tools, D1 semantics, self-heal few-shot, "Live only after green publish".
- **Full API suite: 423/423 passed.** Web + API `tsc --noEmit`: clean.

## Founder D-fix + post-guard re-measurement

Founder chose the minimal path: one isolated orchestrator commit (`9145d11`) — the
**mixed-mode guard** (one tool-call signal per turn; native+fence or multi-call → one
repair-reprompt → honest abort). This directly closes the obs-1 failure mode (a dropped
`index.html`). Then the W10 canonical was re-run **3 more times, fresh project each**:

| Post-guard W10 | State | Verified URL |
|---|---|---|
| run 1 | published | `feel3b-b5-60750.vercel.app` (HTTP 200, dark-mode) |
| run 2 | published | `feel3b-b5-2698.vercel.app` (HTTP 200, dark-mode) |
| run 3 | published | `feel3b-b5-86705.vercel.app` (HTTP 200, dark-mode) |

**W10 pass rate: 4 of 5 clean** (obs-2 + 3× post-guard; the pre-guard obs-1 failure is
excused per the founder rule). Post-guard specifically: **3 of 3 clean.** Interactions
after send: **0** on every run.

## Merge readiness verdict — GO

- Suites green ✓ (423/423) · tsc clean ✓ · ledger M10 updated ✓ · runs 1–3 clean ✓ ·
  **W10 4/5 clean (post-guard 3/3)** ✓ · mixed-mode guard unit-tested ✓.
- Honesty machinery solid on every path (no false "live", ever).
- **Merge condition (≥4/5 W10 clean) MET → conditional merge authorization applies.**
- Broader JSON-fallback hardening stays FEEL-3c, as agreed.
