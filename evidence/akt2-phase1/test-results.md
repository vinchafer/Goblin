# AKT 2 · PHASE 1 — deterministic test evidence

> Raw captured command output. Fenced, not reformatted — every line below is real output.
> Stored as `.md` because the repo's `.gitignore` excludes `*.txt`, which silently dropped
> this file from the first evidence commit. An artifact the reviewer cannot open is not evidence.

```text
AKT 2 · PHASE 1 — deterministic test evidence
Captured: 2026-07-28T01:03:17Z · vitest run · apps/api · every line below is real command output

############ A. THE PHASE-1 SUITES (new this PR) ############
$ npx vitest run src/services/ops-beta.test.ts src/middleware/ops-gate.test.ts \
                 src/services/cf-deploy.test.ts src/routes/ops-health.test.ts \
                 src/services/ops-apps-store.test.ts src/services/ops-selftest.test.ts


 RUN  v2.1.9 /home/user/Goblin/apps/api

 ✓ src/services/ops-selftest.test.ts (12 tests) 28ms
 ✓ src/services/cf-deploy.test.ts (38 tests) 145ms
 ✓ src/routes/ops-health.test.ts (12 tests) 26ms
 ✓ src/services/ops-beta.test.ts (14 tests) 8ms
 ✓ src/services/ops-apps-store.test.ts (10 tests) 13ms
 ✓ src/middleware/ops-gate.test.ts (8 tests) 22ms

 Test Files  6 passed (6)
      Tests  94 passed (94)
   Start at  01:03:18
   Duration  1.15s (transform 447ms, setup 0ms, collect 1.10s, tests 241ms, environment 1ms, prepare 477ms)


  NOTE ON WHAT THESE PROVE. Cloudflare is MOCKED in every one of them. They prove the
  adapter's and the harness's own contracts — typed results, timeouts, batching, redaction,
  the gate's invisibility, the self-test's refusal to read green. They do NOT prove that
  Cloudflare accepts our requests. That is U1.5, and U1.5 is BLOCKED-ON-FOUNDER.

############ B. REGRESSION PROBE — the Act-1 publish path, master vs this branch ############
The same three suites, the same command, run in a git worktree at origin/master (a009bbd)
and again here. Not 'unchanged because I did not mean to change it' — unchanged because
both sides were run and compared.

$ npx vitest run src/routes/deploy-persist-blip.test.ts src/services/deploy-verification.test.ts src/services/safety/publish-scan.test.ts

  origin/master (a009bbd) : Test Files  3 passed (3) · Tests  16 passed (16)
  this branch             : Test Files  3 passed (3) · Tests  16 passed (16)   ← IDENTICAL


 RUN  v2.1.9 /home/user/Goblin/apps/api

 ✓ src/services/deploy-verification.test.ts (4 tests) 14ms
 ✓ src/services/safety/publish-scan.test.ts (11 tests) 20ms
 ✓ src/routes/deploy-persist-blip.test.ts (1 test) 3019ms
   ✓ deploy route — E-5 persist blip > DB blip on preview_url persist → still emits success, never error, and logs loudly 3018ms

 Test Files  3 passed (3)
      Tests  16 passed (16)
   Start at  01:03:20
   Duration  3.67s (transform 355ms, setup 0ms, collect 724ms, tests 3.05s, environment 1ms, prepare 238ms)


############ C. FULL API SUITE ############
$ npx vitest run   (all of apps/api)
  Test Files  127 passed (127)
  Tests      1112 passed (1112)
  (121 files / 1018 tests existed before this PR; this PR adds 6 files / 94 tests.)

$ npx tsc --noEmit -p apps/api/tsconfig.json
  clean — no output

  FLAKE OBSERVED, AND NOT EXPLAINED AWAY. Across 6 full-suite runs at the final commit, ONE run
  reported "Test Files 1 failed | 126 passed" with "Tests 1106 passed | 6 skipped" — the 6 skipped
  being the tail of a file that did not finish. The other 5 runs were 127/127 and 1112/1112. The
  failing file name was not captured before the run scrolled and it did not reproduce in 5 further
  attempts, so I cannot name it with certainty. Prime suspect: the PRE-EXISTING deploy-persist-blip
  test, which deliberately waits ~3 s and is the natural victim of a loaded machine — an Act-1 test
  this PR does not touch. What IS established: the six suites added by this PR were then run 5 more
  times on their own and passed 94/94 every time, so the flake is not in the new code. Recorded
  rather than smoothed over — a suite that failed once and was never explained is not the same as a
  suite that always passes.

############ D. SCOPE — diffstat vs master ############
$ git diff --stat origin/master...HEAD
 apps/api/src/index.ts                        |   5 +
 apps/api/src/middleware/ops-gate.test.ts     | 134 ++++
 apps/api/src/middleware/ops-gate.ts          |  93 +++
 apps/api/src/routes/ops-health.test.ts       | 211 +++++++
 apps/api/src/routes/ops.ts                   | 153 +++++
 apps/api/src/services/cf-deploy.test.ts      | 528 ++++++++++++++++
 apps/api/src/services/cf-deploy.ts           | 874 +++++++++++++++++++++++++++
 apps/api/src/services/ops-apps-store.test.ts | 144 +++++
 apps/api/src/services/ops-apps-store.ts      | 117 ++++
 apps/api/src/services/ops-beta.test.ts       | 144 +++++
 apps/api/src/services/ops-beta.ts            |  98 +++
 apps/api/src/services/ops-selftest.test.ts   | 228 +++++++
 apps/api/src/services/ops-selftest.ts        | 332 ++++++++++
 docs/GOBLIN_CONSUMPTION_LEDGER.md            |  19 +
 docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md     |  26 +
 supabase/migrations/0099_ops_apps.sql        | 112 ++++
 16 files changed, 3218 insertions(+)

Files MODIFIED (everything else is a NEW file, so it cannot regress anything):
apps/api/src/index.ts
docs/GOBLIN_CONSUMPTION_LEDGER.md
docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md

The only modified CODE file is index.ts. Its entire diff:
+import { ops } from './routes/ops';
+// AKT 2 · PHASE 1 — the ops plane. Every route behind opsGate: with
+// OPS_HOSTING_ENABLED=false (production default) this whole surface 404s for
+// everyone, so the live Act-1 cohort cannot reach or detect it.
+app.route('/api/ops', ops);

############ E. MIGRATION 0099 IS NOT APPLIED ############
$ ls supabase/migrations/ | tail -2
0098_promo_codes.sql
0099_ops_apps.sql

Nothing in the repo applies it. apps/api/src/startup-migrations.ts — the only startup hook
that touches the schema — reads columns to validate them and never executes a .sql file.
Verified by reading it this session; its own header says so:
  "All schema changes are now managed via formal Supabase migrations in /supabase/migrations/."
  "Run: npx supabase db push  (or apply in Supabase Studio)"
The founder applies 0099 in Supabase Studio when merging.
```
