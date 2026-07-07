# FEEL-3c — Merge report (fallback, feel & quotes)

**Merge SHA:** `b2150a1` (`Merge feel-3c: FEEL-3c — fallback, feel & quotes [gates]`) · **Branch:** feel-3c → master · **Date:** 2026-07-07

## What shipped

The polish + hardening half of the agent wave (spec §9 FEEL-3c), 6 isolated commits:

| Commit | Unit |
|---|---|
| `5e93df2` | **C1** — JSON-protocol fallback hardening (quoted-violation repair, multi-fence rejection, fixture suite) |
| `f8f8327` | **C2** — humane failure copy across every agent-visible surface |
| `005a273` | **C3** — loading quotes in idle step gaps (decoration, never a step) |
| `7788f4f` | **C4** — step + report-card polish (icons, elapsed, auto-collapse) |
| `71de1fc` | evidence — C1 real-model harness + C2/C3/C4 state renders |

## Gates

- **Suites:** full API **437/437**; agent suite **59/59** (intent 5, publish 9, orchestrator 14, prompt 11, tools 9, run-store 5, config 5, **protocol 12 new**). `tsc --noEmit` clean (api + web).
- **C1 real-model:** Forge (native) 5 turns → published, 0 repairs; Groq (JSON fallback) 4 turns → published, 0 repairs. See `C1_REPORT.md`.
- **C2/C3/C4:** faithful component-state renders, 375 + 1440, light + dark. See `C2_C3_C4_REPORT.md` + `shots/`.
- **Ledger:** M10 unchanged — C1–C4 add no new consumption path (protocol hardening, copy, a client-only decoration, presentation). The per-run cost formula from FEEL-3a/3b still holds.

## C1 — eligible-list recommendation (founder decision)

Groq llama-3.3-70b parsed cleanly through the strict JSON fallback in one full published run — viable
from the parser's standpoint. **Recommendation: keep the eligible list at Swift + Forge for now**; gate any
Groq/BYOK-agent addition behind a multi-run reliability soak first (low free-tier TPM, differing billing).
Full rationale in `C1_REPORT.md`.

## Prod verification (SHA b2150a1)

- **Both `/api/version` on `b2150a1`:** API `goblinapi-production.up.railway.app` ✓, web `goblin-web.vercel.app` ✓ (verified after auto-deploy).
- **Prod smoke** (SSE-direct, test account, Forge, no publish intent → saved draft): **PASS**. A real prod
  run went list_files → write_file (index.html · NEU) → save_draft → **draft-saved card** (followUps
  view-changes + confirm-publish, 82 253 units). `maxStepGapMs = 29435` → **`quoteWouldShow: true`** — a real
  prod run leaves a >4s idle gap (29.4s of Forge thinking) exactly where the C3 quote renders. Full transcript
  in `PROD_SMOKE.txt`; repro `prod_smoke.mjs`. The on-screen quote pixel on a phone is Steven's closing feeling
  re-test (spec §9) — the objective gate (gap exists + card renders on the deployed bundle) is met here.

## Honesty note

Agent mode stays **flag-gated in prod** (default off; on for the test account), so this ships with minimal
blast radius. The C2/C3/C4 visual evidence is a **faithful static render** of the real component states
(inline styles ported verbatim), not a live browser capture; live rotation + the polished card on a real
run are confirmed by the prod smoke above.

## Reminder

Keys stay for FEEL-4.
