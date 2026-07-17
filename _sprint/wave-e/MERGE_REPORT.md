# WAVE-E — Multi-File-Intelligenz & Framework-Support · MERGE REPORT (Session 2, BUILD)
**Branch `wave-e-build` · base `origin/master` @ `bb97e1a` · Opus · 2026-07-17**
**Founder decisions: D-E1=A (deploy source → Vercel builds) · D-E2=allowlist · D-E3=react-vite**

## Context (3 lines)
Session 1 produced the spike + decision tables; the founder chose A / allowlist / react-vite.
This session built E1–E5: the agent now sees a project as an import graph, scaffolds a real
React/Vite project, adds npm deps safely behind an allowlist, and deploys framework projects
via the user's own Vercel (Vercel builds from source). State-first: local `master` was stale;
the branch is rebased onto the true `origin/master @ bb97e1a` (Wave C / Workspace-Explorer),
which has **zero file overlap** with this wave — the diff below is against that real base.

## Per-unit table
| Unit | Commit | What | Gate evidence | Status |
|---|---|---|---|---|
| **E1** | `99d1c85` | Import-graph parser → compact dependency graph in the shared project context (chat + agent); on-demand `read_file`. Additive behind `hasModuleEdges()` detection → static prompt byte-identical. **M14 ledger, same commit, MEASURED.** | `import-graph.test.ts` (14, incl. the M14 measurement), `wave-e-graph-context.test.ts` (4, incl. static byte-identical) | **DONE** |
| **E2** | `a907457` | React/Vite template registry (beauty-block compliant) + `create_project_structure` tool through the attested write pipeline + few-shots (scaffold → component → wire → build green). | `framework-templates.test.ts` (9), `create-project-structure.test.ts` (3, incl. unsupported-framework refusal) | **DONE** |
| **E3** | `04e3a7a` | Dependency allowlist + exact-pin enforced in the write tail (blocks a malicious/typosquat `package.json` from both `write_file` and `edit_file`); Vercel build-from-source (`framework:'vite'` + `skipAutoDetectionConfirmation`, `builtOutput` truth-gate, 240s build poll). **Adversarial test.** | `deps-allowlist.test.ts` (12), `dependency-adversarial.test.ts` (3), `wave-e-deploy.test.ts` (7) | **DONE** |
| **E4** | `7ad1a3e` | The verbatim proof, generated from the ACTUAL Wave-E code. | `evidence/wave-e/` (`PROOF.md`, `build.log`, `import-graph.txt`, `runtime-smoke-result.json`, `proof-app-src/`) | **DONE (deploy = founder action)** |
| **E5** | `39fc3b1` | Honest edges DE+EN: build-failure (build-aware), unsupported-framework, dependency-rejected; + framework-limits block in the agent prompt. | `wave-e-honest-edges.test.ts` (4) + the E2/E3 edge tests | **DONE** |

**Numeric acceptance:** new Wave-E tests = **56** (14+4+9+3+12+3+7+4). Full API suite **943 passed / 0 failed / 109 files**; **tsc clean**. Money suites: **Stripe-gated (self-skip without `sk_test_` keys), run in CI — this diff touches zero billing/money/Stripe files, so they are unaffected (unchanged 17/17 in CI).**

## E4 — the proof, evidenced
Prompt (verbatim): *"Baue eine React-App: eine Aufgabenliste mit einer wiederverwendbaren TaskItem-Komponente, State im Parent, und stell sie live."*

| Claim | Status | Evidence |
|---|---|---|
| Multi-file React project | **VERIFIED** | `evidence/wave-e/proof-app-src/` (12 files) |
| TaskItem a real separate importing component | **VERIFIED** | `import-graph.txt`: `App.tsx · nutzt: … src/components/TaskItem.tsx, src/types.ts`; `TaskItem.tsx · exportiert: TaskItem` |
| State im Parent | **VERIFIED** | `proof-app-src/src/App.tsx` holds `useState`; `TaskItem` is stateless props-in |
| Builds clean (R2) | **VERIFIED (deterministic)** | `build.log`: real `npm install` + `tsc && vite build` → **✓ 33 modules, exit 0** |
| Runtime smoke green | **VERIFIED (headless Chromium)** | `runtime-smoke-result.json`: renders, toggle flips parent state, add 2→3, **0 JS errors** |
| Own-Vercel deploy + live URL + deploy-verification VERIFIED | **FOUNDER ACTION** | Needs the test-account Vercel token (Gesetz 7/8); code path unit-tested (E3); exact steps in `PROOF.md` |

## Self-review checklist (OS §3, explicit)
1. **Evidence audit** — every gate maps to a test re-run green this session (943 passed, final run 23:01). E4's build+smoke are real artifacts in `evidence/wave-e/`, re-opened and matching the claims.
2. **Diffstat vs scope** — `git diff origin/master..HEAD` = 33 files, each justified by a unit (E1: import-graph + context + ledger; E2: framework-templates + tool + prompt; E3: deps-allowlist + tools + vercel-service + deploy-verification + publish; E4: evidence + template fix; E5: publish edge + prompt). No drive-by edits. Consumption path (M14) in the ledger, same commit as E1.
3. **Regression** — the static path is provably unchanged: no graph block renders without module edges (test), and the deploy POST is byte-identical when there is no `package.json` (`detectVercelFramework` → null; test). Full suite incl. Wave-C/D/F paths green post-rebase.
4. **Honesty sweep** — new user strings (build-failure, unsupported-framework, dependency-rejected) are DE+EN, actionable, no raw traces, no invented capability. The prompt advertises only what the tools do.
5. **Ledger** — M14 added same commit as E1, with the **real measured** figure (245 tok / 6.2×), and it **honestly corrects the spike's 25–30× estimate down** to the measurement (Gesetz 2).
6. **Report completeness** — base SHA, per-unit commit SHAs, evidence refs, Honest-Limitations (below), founder actions (below), numeric pass rates — all present.
7. **Steven question** — "would a skeptical reviewer, with only my evidence, reach my verdict?" For E1/E2/E3/E5: yes (tests + measured ledger). For E4: the honest verdict IS "build + runtime VERIFIED deterministically here; live own-Vercel deploy is the one founder-gated step" — labeled, not false-greened.

## Migrations
**None authored this wave.** (Next free number remains **0096** if a later wave needs one.)

## Honest limitations
- **The live own-Vercel deploy for E4 is not run here** — it needs the test-account Vercel token (a live third-party mutation this session must not hold, Gesetz 7/8). Build + runtime are proven deterministically; the deploy is a prepared founder action with exact steps in `PROOF.md`. UNVERIFIED-BY-DEPLOY, honestly labeled.
- **M14 is measured on ONE sample** (a realistically-formatted 15-file React app): **245 tok, 6.2× cheaper** than full-content injection — lower than the spike's 25–30× estimate because the E4 task-list is a small real app (~6k chars of source). The token count is close to estimate; the ratio grows with project size (graph scales with file count, not size). Widen with prod telemetry.
- **Graph v1 parses loaded content only** — a source over the M2 48k budget contributes no edges yet (future: a lightweight graph-only read). Noted in M14.
- **Dependency "pinning" is manifest-level** (exact versions in `package.json`), not a full integrity-hash lockfile — the allowlist is the primary supply-chain defense; a committed lockfile with hashes is a future enhancement.
- **Framework set v1 = React/Vite only.** Next.js is deferred (D-E3); the unsupported-framework edge is honest about it.
- **Build correctness is verified at publish** (via the `builtOutput` truth-gate on the user's Vercel), not before — a pre-publish preview build is a possible future enhancement (spike §D-E1 note).

## Founder actions
1. **Review + grant merge.** Merge is founder-granted only (CLOUD RIDER rule 1) — this PR HALTs at branch + PR.
2. **Run the E4 live-deploy proof on the test account** (`vinc.hafner3@`): connect a free Vercel token, send the verbatim E4 prompt, capture the VERIFIED live `*.vercel.app` URL. Steps in `evidence/wave-e/PROOF.md`. **Test account only — never the personal account.**
3. **Optionally widen the allowlist** (`apps/api/src/services/deps-allowlist.ts`) — it's a single, reviewed source of truth; a founder-approved edit is the only way to add a package (security-model decision, OS §4).
4. **Note for a future wave:** a committed lockfile-with-hashes and a pre-publish preview build are the two recorded enhancements above.

## CI ground truth
To be observed on the PR (rider #6: CI truth = job logs). The checks this wave gates — API unit tests (incl. the 56 new tests) + Typecheck & Build — are green locally (943 passed, tsc clean). E2E is a pre-existing master concern outside this wave's diff (this wave adds no web-route behavior; the one web file touched is a prompt string in `apps/api`, not `apps/web`).
