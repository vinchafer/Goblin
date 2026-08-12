# AKT 2 · PHASE 2 — evidence index

Branch `claude/phase2-founder-window-e2e-1tehmn` · based on `origin/master` @ `f247131` · 2026-08-12

| File | What it is | How to read it |
|---|---|---|
| `e2e-founder-window-2026-08-12.json` | The full result of the U2.8 end-to-end run, as the console copied it | Deterministic. Every number is a count. The file is the run's own output, not a retelling of it. |

## The run

**Run by the founder, from the ops console (`/dashboard/konsole` → „E2E starten"), against the real
Cloudflare infrastructure** — real R2, real KV, the real router Worker on `justgoblin.app`, the real
`ops_apps` registry. Not a mock, not a fixture, not a local harness. The founder triggered one
authorised request; the deployed code did the work, so no session and no human ever touched a
Cloudflare token (`OPS_SPIKE_0_DECISION_TABLE.md` §4.4). `producedAt: 2026-08-12T12:47:06.145Z`.

| Gate | Result | Where in the file |
|---|---|---|
| Steps | **19/19 green** | `run.steps` — 19 entries, every one `ok: true`, hence `run.passed: true` |
| `publishLoops` | **5/5** | `run.numbers.publishLoops` |
| `scanBattery` | **9/9** | `run.numbers.scanBattery` |
| `suspensionRoundTrip` | **3/3** | `run.numbers.suspensionRoundTrip` |
| `tookMs` | **13033** (13.0 s) | `run.tookMs` |

Every figure above is read off the committed file, not reported alongside it. `run.passed` is not a
verdict anyone typed: the report sets it only when *every* step is `ok`, so it and the 19/19 are the
same fact stated twice. `run.notes` is empty — the run's own belt-and-braces check for bytes left
behind after teardown found nothing to report.

The JSON is the artifact the console's „Ergebnis kopieren" button produces: scrubbed of email
addresses and anything shaped like a key before it ever reaches the clipboard (U-C5, `scrubReport`
in `apps/web/app/dashboard/konsole/strings.ts`). What is missing from the file is missing by design;
nothing else was edited.

## Why 13 seconds, when the console says 5–15 minutes

The console's own copy warns the run „Dauert 5–15 Minuten". That estimate assumed the run would
spend most of its time *waiting* — polling a public URL until a publish, a rename, a suspension, an
unsuspension and a teardown became visible at the edge. It did not have to wait once: **all six
propagation measurements in the file are `propagationSec: 0`** (`public:serves`, `rename:old-410`,
`rename:new-200`, `suspend:page-live`, `unsuspend:restored`, `teardown:404`). The elapsed time is
therefore not a faster run of the same work; it is the same work with the waiting removed, and the
six zeroes are the arithmetic that makes 13 seconds add up rather than look wrong.

One consequence worth knowing before it surprises someone: the console's summary line renders
elapsed time in whole minutes, so this run's reads **„· 0 min"**. That is a rounding artefact of a
run faster than the unit it is displayed in, not a missing measurement — `run.tookMs` has it exact.

See `docs/ABUSE_RESPONSE.md` §8.3 for what those zeroes do and do not license us to claim.

## Two things the file settles that the headline numbers do not

**The audit trail actually wrote.** `migrations.audit: true`, and `suspend:flip` reports
`route ok, registry ok, audit written`. Migration 0100 was applied before the window, so the
suspension wrote its evidence row instead of degrading to `audit: "unavailable"` — the failure mode
`AKT2_PHASE2_FOUNDER_WINDOW.md` §0 warned about did not happen.

**The documented grey-cloud trap was clear.** `router.wildcardProxied: true` alongside
`zoneFound`, `routeBound` and `workerDeployed`. A `*` record can exist and still not be proxied, in
which case the Worker never runs; the preflight checked rather than assumed.

## What this run closes, and what it does not

**Closes:** the four Phase-2 requirements in `ABUSE_RESPONSE.md` §8.3 move from *built and
test-covered* to *verified by run on the real infrastructure* — the state the Phase-2 PR explicitly
left open („gebaut ≠ bewiesen").

**Does not close:** anything about behaviour under load, over time, or across Cloudflare locations.
This is **one run**. The numbers are what happened once, on 2026-08-12, from one place on the
planet. Read every timing in it as an observation, never as a bound — six zeroes measured from one
vantage point say nothing about a location whose KV cache is holding the old route.
