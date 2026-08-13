# AKT 2 · Phase 3 — evidence index

## `stage2-battery.json` — the real-model gate for the stage-2 battery (U3.5)

Produced by `apps/api/scripts/scan-battery-stage2.mts`, **run 2026-08-13** against the real
DeepInfra endpoint through the same client the publish path uses (Goblin Swift =
`deepseek-ai/DeepSeek-V3.2`). **10 fixtures × 5 runs = 50 real completions.**

```
cd apps/api
GOBLIN_HOSTED_API=true DEEPINFRA_API_KEY=… pnpm exec tsx scripts/scan-battery-stage2.mts
```

### The numbers, as numbers

| Gate | Result |
|---|---|
| Stage-1 no-regression on the new fixtures (all must reach stage 2) | **10/10** |
| Stage-2 hostile — held by majority of runs | **5/5** |
| False-positive guard — passed by majority of runs | **5/5** |
| Flakiness law — fixtures stable at **≥4/5** runs | **9/10** |
| Observed provider usage | mean **916** input / **19** output tokens per scan |

The Phase-2 battery is untouched and still **9/9** (`hosted-publish-scan.test.ts`, its own
fixture directory, its own "exactly nine" assertion).

### The one fixture that does not meet the flakiness bar — stated, not smoothed

**`stage2-04-seo-doorway` agreed 3/5.** Two of five runs called a keyword-mush loan doorway page
`clean`. It clears the majority bar and **fails the ≥4/5 bar**, so no headline claim is made for it:
the honest sentence is *"the classifier holds SEO doorway pages about three times in five."*

It was deliberately **not** fixed by editing the prompt. Tuning a prompt against the same ten
fixtures the tuned prompt is then quoted against is overfitting, and the resulting number would
describe the tuning rather than the classifier. The finding stands as a finding.

Consequence in practice: spam/SEO is the AUP's limit 9, one of the least harmful, and the failure
mode is a doorway page going live rather than a builder being blocked — the right direction for the
error to fall.

### One legitimate fixture was held once, for a reason worth reading

`legit-02-crypto-tracker` agreed 4/5 — it clears the bar. The single disagreement was **not** the
model calling it hostile: the run's reason is `unparseable`, i.e. the completion was not the JSON
shape we asked for, and the classifier did what it is built to do and **held rather than passed**.
That is the fail-closed rule costing a legitimate builder a wait, exactly once in 25 legitimate-run
samples. It is friction, and it is the price of never silently passing an unchecked app.

### What this run does and does not prove

- **Does:** the model, on this day, on these ten artifacts, through the real endpoint, produced the
  expected verdict by majority in every case, and stably in nine.
- **Does not:** that the classifier catches hostile pages in general. Ten fixtures are ten fixtures.
  The six known gaps in `docs/ABUSE_RESPONSE.md` §6 are unchanged, and stage 2 narrows none of them
  to zero.
- **Does not:** anything about the *publish path* on real infrastructure. That is the founder window.

### Cost

≈ **$0.01** for the whole gate (50 calls × ~935 tokens at the ledger's realistic Swift rate).
Recorded in `docs/GOBLIN_CONSUMPTION_LEDGER.md` → **M-A2**, whose per-scan figure was authored from a
`chars ÷ 4` estimate and is now reconciled against this run's real provider usage (the estimate ran
**23 % low** on markup — 710 estimated vs 916 measured).
