# WAVE-K — Missbrauchs-Risiko gegen null (fünf Schichten) — MERGE REPORT

**Branch:** `claude/wave-k-safety-layers-rr5u07` (from `origin/master` @ `caaf56d`)
**Session model:** claude-opus-4-8 · **Date:** 2026-07-11
**Status: PR-READY — HALT before merge.** (See "Merge decision" below.)

## Honest framing (stated in every doc this wave produced)
"Zero" does not exist. This wave builds **five layers** that push realistic risk near
zero for Goblin's scale and shape, and **documents the residual honestly** — which is
what a diligence reviewer actually wants to see. The structural advantage, named
explicitly in K1/K5: **Goblin never publicly hosts user content** — generated apps deploy
to the user's OWN Vercel account; project storage (B2) is private. The abuse surface is
therefore (a) what the agent BUILDS (K2), (b) what the pipeline SHIPS (K3), (c) platform
resources (Wave-D). The hosting layer — and Vercel's own trust & safety — belongs to the
user and Vercel.

## Phase 0 — state-first + Wave-D deferred probes
- **State:** confirmed `origin/master` @ `caaf56d` (Wave-D merged: PRs #24/#25). Branch was
  even with master — no prior Wave-K work. Prompt context matched the repo.
- **Wave-D deferred probes (path-traversal write · cross-project/RLS read): BLOCKED —
  honest.** This session holds **no** Goblin/Supabase/Vercel credentials and no anon key
  (verified: only inference keys — DeepInfra/Brave — are present). Minting authenticated
  requests against PROD is impossible here without violating the no-secrets rule.
  **Founder action to run them** is listed below. The D-1 traversal defense itself is
  already unit-covered (`file-storage.security.test.ts`, `tools.security.test.ts` — 17+ tests green).

## Per-unit table

| Unit | Commit | What | Gate evidence | Status |
|---|---|---|---|---|
| K1 | `ace9931` | AUP/Nutzungsrichtlinie DE+EN + links | `/acceptable-use` prerenders (build 41/41 ○); links at signup consent + login footer, legal footer, landing footer, sitemap | ✅ |
| K2 | `d1f9183` | POLICY section (agent+chat+support) | Prompt test 17/17; **real-model 5/5 policy + 3/3 regression = 8/8** (`evidence/wave-k/K2_refusal_gate_transcript.txt`); prefix-stability 5/5 | ✅ |
| K3 | `0f6416d` | Publish-time deterministic scan + appeal | `publish-scan.test.ts` **11/11** (blocks phishing/miner/card/iframe; PASSES own-app + OAuth login; obfuscation logs LOW; degrade-open) | ✅ |
| K4 | `f711fac` | Velocity/pattern signals → platform_events | `signals.test.ts` **12/12** (each flag fires on fixture, silent on baseline, degrades on dep failure); dashboard card added | ✅ |
| K5 | `f66f331` | ABUSE_RESPONSE runbook + residual-risk | Doc complete; **Vercel abuse route verified 2026-07-11** (vercel.com/abuse → "Phishing or Malware"; dmca@vercel.com) | ✅ |
| Ledger | `5c5d312` | M13 row + AUP lint fix | Ledger M13 (K2 negligible, K3/K4 zero tokens) | ✅ |

## D-K1 decision (recorded) — **Option A** (founder-granted, pasted)
> "Option A, hart blocken nur High-Confidence-Phishing/Malware, Rest loggen."

Implemented exactly: `scanFiles().blocked = hits.some(h => h.confidence === 'high')`.
HIGH → hard-block: `PH-BRAND-CRED`, `MW-MINER-SIG`, `PH-CARD-MAILTO`, `PH-HIDDEN-IFRAME-AUTH`.
LOW → log-only (never blocks): `MW-OBFUSCATED-EVAL` (obfuscation alone ≠ block),
`PH-CRED-FOREIGN-POST`. Rule list lives in the maintainable `scan-rules.ts`.

## False-positive discipline (this wave's own failure mode)
Every blocking mechanism ships with a **legitimate-case probe that must PASS**:
- K2: few-shot ③ + regression 3/3 — the user's OWN-app login is built normally (real model).
- K3: `LEGIT_OWN_LOGIN` (no foreign brand) and `LEGIT_OAUTH_LOGIN` ("Sign in with Google")
  both PASS; obfuscation-only does NOT block. All green.
- K4: each evaluator stays silent on the honest baseline (established account, 1 publish,
  distinct content).

## Self-review checklist (OS §3)
1. **Evidence audit:** every referenced artifact re-opened — K2 transcript shows 8/8 verbatim
   with reason+legitimate-path; test outputs pasted in commits.
2. **Diffstat vs scope:** 28 files, all justified by a K-unit (5 safety modules + 2 prompts +
   2 publish paths + 4 web link/appeal surfaces + 3 docs + tests). Consumption path: deploy
   route + agent publish (ledger M13).
3. **Regression:** API vitest **687 passed / 16 skipped / 0 failed** (full suite). Web + shared
   typecheck clean. Web build 41/41 pages with env present.
4. **Honesty sweep:** new German strings name the reason + legitimate path; the `chat` icon on
   the appeal button is real (verified in `icon.tsx`); legal marker present on page AND doc.
5. **Ledger:** M13 added same-wave (K2 prompt tokens negligible/cache-warm; K3/K4 zero tokens).
6. **Report completeness:** this file — per-unit SHAs, evidence refs, Honest-Limitations,
   founder actions, numeric rates.
7. **Skeptic test:** a reviewer seeing only the transcript + test outputs + verified Vercel
   route reaches the same verdict.

## CI ground truth (verified locally; not from cached status)
CI (`.github/workflows/ci.yml`) gates on: **typecheck shared/web · web build · API vitest.**
- Typecheck shared ✅ · web ✅ · API `tsc` ✅
- API vitest ✅ **687 passed, 0 failed**
- Web build ✅ (with public Supabase env present: 41/41 static pages incl. `/acceptable-use`;
  in this sandbox the build compiles + typechecks clean but prerender of the unrelated
  `/demo-preview` page needs Supabase env the sandbox lacks — CI provides it).
- **Pre-existing baselines named (rider #6):** (a) web `eslint .` is **already red on master —
  130 errors** (`react-hooks/static-components`, `set-state-in-effect` across untouched files);
  CI does **not** run web eslint, and my branch adds **zero** new lint errors (130 → 130).
  (b) E2E (`e2e.yml`) baseline was recorded red pre-Wave-K (master commit `864e412`: "e2e red
  is pre-existing"); not runnable here (browser + prod secrets). My changes only ADD footer
  links / a new static page — no existing selector removed.

## Merge decision — **HALT (not merged).** 
The standalone prompt offered a conditional merge; **CLOUD RIDER v2 rule #1 (branch + PR,
merge is founder-granted only) governs and overrides.** Independently, two conditional-merge
preconditions **cannot be evidenced in this session** and per OS Law 3 any un-evidenced gate
means HALT before the outward-facing step:
- **prod smoke** (probe ① refusal on prod + one legit build unaffected) — needs Goblin prod
  auth this session does not hold.
- both `/api/version` checks — same.
The K2 real-model gate WAS run against the real model (DeepSeek V3.2, the wholesale model
Goblin Swift routes to) with the exact augmented prompt — 8/8 — but **directly**, not through
Goblin's authenticated PROD endpoint (no auth token here). Recorded as an honest deviation.

**Recommendation:** founder reviews, then merges `--no-ff` after running the prod smoke +
the two Wave-D probes below.

## Honest limitations
1. **Wave-D probes BLOCKED** (no credentials this session) — founder action below.
2. **K2 real-model gate ran direct-to-model, not through Goblin PROD-with-auth** — same 8/8
   signal, documented deviation (`scripts/wave-k-refusal-gate.mts` header).
3. **Prod smoke + `/api/version` not run** — needs prod auth; merge precondition deferred to founder.
4. **K4 velocity/fan-out wired on the deploy-route publish path** (the "Live stellen" button),
   not the agent publish path; the velocity flag still counts publishes from both (it reads
   `projects.last_deployed_at`). Agent-path fan-out is a small follow-up.
5. **Residual risk is real and documented** (`docs/ABUSE_RESPONSE.md` §6): novel social
   engineering, post-publish content on the user's Vercel, determined adversaries,
   signature-free obfuscated miners, brand false-negatives, signals nobody reads.
6. **Migrations:** none authored this wave — the new event types (`publish_blocked`,
   `abuse_signal`) need no schema change (migration 0085 dropped the `event_type` CHECK).

## Founder actions
1. **Legal review** of the AUP (+ AGB) before scaling — AI-drafted, not lawyer-reviewed
   (marked on page + doc).
2. **Run the two Wave-D probes** against PROD with the test account(s): (a) a path-traversal
   write through the agent file tools → expect denied; (b) a cross-project read + the RLS
   cross-read per `_sprint/wave-d/SECURITY_AUDIT.md` (two test accounts + anon key) → expect denied.
3. **Prod smoke before merge:** probe ① (PayPal-clone build request) refuses on prod + one
   legitimate build unaffected; confirm both `/api/version`.
4. **Re-verify the Vercel abuse route** half-yearly; update the date in `docs/ABUSE_RESPONSE.md` §4.
5. **Tune thresholds** if needed: `ABUSE_PUBLISH_VELOCITY` (5), `ABUSE_CONTENT_FANOUT` (3),
   `ABUSE_REPEATED_BLOCKS` (3) — env-knobbed.
6. **Grow `scan-rules.ts`** with each real abuse case (new rule + fixture).

— HALT. Standing by for founder feedback.
