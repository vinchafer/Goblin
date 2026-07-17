# WAVE-E — Multi-File-Intelligenz & Framework-Support · SPIKE (Session 1)
**Branch `claude/wave-e-gbnq14` · base `origin/master` @ `8af3589` · Opus · 2026-07-17**
**Runbook 4 · SPIKE ONLY — research + decide. No build, no accounts, no deploy. HALT for founder gates D-E1 / D-E2 / D-E3 at the end.**

---

## Phase 0 — State-first (OS §5b, Methodik Gesetz 10)
Both mandatory docs present and re-read this session: `docs/GOBLIN_ARBEITSMETHODIK.md`, `docs/OPUS_OPERATING_SYSTEM.md`. Session-mode gate: the prompt's `FOUNDER DECISIONS` block is still `<placeholders>` → **this is Session 1 (SPIKE)**, per the prompt's own rule "Empty → you are in Session 1."

**Repo reality established by reading the code (not the prompt's assumptions):**

| Claim to verify | Repo truth | Evidence |
|---|---|---|
| "Today the agent builds single-page / few-file apps" | TRUE. Context strategy is a **flat file list**; contents are budget-capped and prioritized `index.html → files referenced by index.html's `src=`/`href=` → smallest-first`. **No JS/TS import graph** — references are found by an HTML-attribute regex only. | `apps/api/src/services/project-context.ts:56` (`referencedPaths` = `src=`/`href=` regex), `:82-121` (priority), `FILE_CONTENT_BUDGET_CHARS = 48_000` `:14` |
| Deploy path | Uploads **raw project files** to Vercel `v13/deployments` as **inline base64**, with **`projectSettings: { framework: null }`** → **Vercel serves the files statically, it does not build them.** | `apps/api/src/services/vercel-service.ts:221-233` (POST, `framework: null`, `files: vercelFiles` base64) |
| File-count ceiling on deploy | Hard **100-file slice**, warn-and-truncate above that. | `vercel-service.ts:187-192` |
| Any build/bundler execution in Goblin infra today | **None.** No Railway build job, no WebContainers, no `esbuild`/`vite`/`rollup` dependency, no `child_process`/`npm install` on any code path. Goblin never executes user code. | `apps/api/package.json` (no bundler dep); grep for `webcontainer|npm install|child_process|spawn` over `apps/api/src` + `packages` = zero build-execution hits |
| Agent tool set | `plan · list_files · read_file · write_file · edit_file · save_draft · publish · read_deploy_status · finish` (+ `web_search`, `restore_checkpoint` gated). All thin adapters over hardened services; **no `create_project_structure`, no dependency tool.** | `apps/api/src/services/agent/tools.ts:48-174` |
| Wave-D sandbox (coordination point for D-E2) | Wave-D hardened **Goblin's own server-side tool execution**: path canonicalization + prefix-assert (`project-path.ts`), per-user abuse caps (agent runs / publishes / uploads / builds), secret scrubbing. It did **not** add a code-execution sandbox, because **Goblin runs no user code today.** | `_sprint/wave-d/MERGE_REPORT.md` (D-1…D-5) |
| Templates | DB-backed (`templates` table, `files: Record<path,string>`), copied into project storage on create. No framework/build metadata beyond a free-text `tech_stack`. | `apps/api/src/routes/templates.ts:52-117` |
| Next free migration number | **0096** (last applied-authored is `0095_project_checkpoints.sql`). | `supabase/migrations/` |

**Consequence for the design:** the single most important state fact is that **the current deploy already POSTs source files to Vercel as inline base64 with `framework: null`.** "Deploy source + let Vercel build" (Steven's prior) is therefore **not new infrastructure** — it is a *configuration change on the path that already runs*: include the framework's source files, and set `framework` (or auto-detect) instead of `null`. This reframes the whole cost/risk picture below.

---

## Decision 1 — Build/bundler: WHERE does the multi-file project get built? (→ D-E1)

The three candidates from the prompt, scored honestly. "Own-Vercel-fit" is weighted heaviest because it is a **recorded founder product decision** (users deploy to their *own* Vercel; Goblin holds no platform build account for user apps).

| Option | How it works | Cost (who pays) | Latency | Own-Vercel fit | Complexity / new surface | LIVE-USER regression risk |
|---|---|---|---|---|---|---|
| **A · Deploy source → Vercel builds** *(Steven's prior)* | Extend the **existing** `deployToVercel` POST: include `package.json` + source (`src/`, `vite.config.ts`, `index.html`), set `projectSettings.framework` (e.g. `"vite"`) instead of `null`. Vercel runs `install` + `build` in **the user's own Vercel build sandbox** and serves the output. | **$0 to Goblin.** Build compute is on the **user's own Vercel** (Hobby: 6,000 build-min/mo included; a Vite build ≈ 1–3 min). No Goblin COGS. | One build ≈ Vercel `QUEUED→BUILDING→READY`; Vite apps typically 1–3 min (vs today's instant static serve). Polling loop already exists (`publish.ts pollUntilReady`, 90 s deadline — **needs widening**, see edges). | **Best.** It IS the own-Vercel model. Nothing deployed by Goblin; the user's token, the user's account, the user's build. | **Lowest.** Reuses the exact code path already in prod. Change = which files we send + one `projectSettings` field + a longer poll deadline. Additive behind `package.json` detection. | **Lowest.** Static projects (no `package.json`) keep `framework: null` → byte-identical to today. Framework path only engages when a `package.json` is present. |
| **B · Client-side (WebContainers-class)** | Run `npm install` + Vite build **in the user's browser** via StackBlitz WebContainer API. | **Licensing cost, undisclosed.** `webcontainer-core` (the runtime shell) is MIT, **but production commercial use of the WebContainer *API* requires a paid commercial license** — pricing is contact-sales only; a "nominal charge" applies above **10,000 API requests/month**. This is a **new paid dependency → founder-gate + Escalation-table "New dependencies with cost."** | In-browser, no server round-trip once loaded — but a heavy first-load (multi-MB runtime + `npm install` in-browser). | **Poor fit.** Produces a build *in the browser*; you still have to ship the output to the user's Vercel to deploy → doesn't replace the deploy step, adds a step. | **Highest.** New third-party API, new licensing relationship, requires **cross-origin isolation (COOP + COEP headers)** on the app shell — non-trivial and can break other embeds. | **Highest.** COOP/COEP headers are app-wide; **375px-first mobile** browsers have the weakest SharedArrayBuffer/WebContainer support → a live-user regression vector on the exact devices Goblin targets. |
| **C · Railway build job** | Goblin spins a server-side container, runs `npm install` + build, ships output to Vercel. | **Goblin COGS + a new always-on/queued build worker.** Goblin now **executes untrusted user dependency trees on its own infra** → the full supply-chain surface lands on Goblin. | Container cold-start + install + build; slowest and most operationally heavy. | Neutral-to-poor: output still deploys to user Vercel, but the *build* is now Goblin's liability, not the user's. | **High.** New worker, new queue, and — critically — **a real code-execution sandbox Goblin does not have today** (Wave-D never built one because nothing ran user code). | Medium, but introduces an entirely new failure domain (build worker) into a live product. |

**Recommendation → D-E1 = Option A (deploy source → Vercel builds).**
Rationale, honestly weighed: it is $0-COGS, it is *the* own-Vercel model rather than a bolt-on, it is the smallest diff (one config field + file selection on an already-hardened path), it keeps the static path byte-identical (LIVE-USER rule), and it moves the dependency-*execution* surface onto the **user's own isolated Vercel build**, not Goblin's infra. **Steven's prior survives verification** — the numbers do not kill it; they favor it. Options B and C both introduce a new paid dependency and/or a code-execution sandbox Goblin would have to build and secure from scratch, for no fit advantage.

*Honest counter-note (not a blocker):* Option A gives Goblin **no pre-deploy build signal** — the first time a framework project's build is validated is *on Vercel, at publish*. R2 ("build correctness — verified, not assumed") is therefore satisfied **at publish time via the existing P0.2 truth-gate** (`deploy-verification.ts` already re-fetches the live URL + every referenced asset), not at write time. If the founder wants a *pre-publish* build check, that is a Vercel **preview** deployment (still the user's account, still $0 to Goblin, one extra deploy) — flagged as an E-build option, not a v1 requirement.

---

## Decision 2 — Dependency safety: allowlist vs full-npm vs lockfile-pinning (→ D-E2)

**Coordination with Wave-D (don't duplicate):** Wave-D's model sandboxes *Goblin's* server-side tool execution and rate-limits abuse. It is **orthogonal** to dependency safety here, because under D-E1=A the dependencies are **installed and executed on the user's own Vercel build**, never on Goblin infra. So the residual risk this decision must bound is **not** "malicious package pwns Goblin's server" (it can't reach it) — it is: **"can the agent be tricked into writing a malicious / typosquatted / data-exfiltrating package name into the `package.json` that Goblin authors on the user's behalf, which then runs in the user's build and ships in the user's live site?"** That is a *content-authoring* trust problem, and the E3 adversarial test targets exactly it.

| Option | Mechanism | Security surface | Supply-chain risk | DX / capability |
|---|---|---|---|---|
| **Allowlist** | Curated set of vetted packages + version ranges the agent may add (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, a short list of popular safe libs). Anything else → honest "nicht in der Freigabeliste" refusal. | **Smallest.** The agent literally cannot author a name outside the vetted set; typosquat/exfil packages are unreachable. | **Lowest.** Only pre-reviewed packages ever enter a `package.json`. | Bounded: covers the React/Vite baseline + common needs; niche libs need a founder-reviewed allowlist addition (honest limit, expandable). |
| **Full npm** | Agent may add any package from the registry. | **Largest.** Full typosquatting / install-script / dependency-confusion surface, now *authored by Goblin* into the user's build. | **Highest.** This is the surface the E3 adversarial test is designed to break; hard to make safe without a vetting service. | Maximal capability, maximal risk. |
| **Lockfile-pinning** | Agent proposes packages; every entry is pinned to an exact version + integrity hash in a committed lockfile. | Medium. Pinning stops *version drift* and post-hoc tampering, but **does not vet whether the pinned package is itself malicious** — a pinned typosquat is still a pinned typosquat. | Medium: solves mutation, not selection. | Good reproducibility; orthogonal to selection safety (composes *with* an allowlist). |

**Recommendation → D-E2 = Allowlist v1 (curated), composed with lockfile-pinning for the allowed set.**
The allowlist bounds *selection* (the actual attack the adversarial test probes), pinning bounds *mutation*; together they give a small, honest, expandable surface with $0 vetting cost. Full-npm is the founder-gated future once a vetting story exists. The v1 allowlist should ship as a **single source-of-truth constant** (one file, so the E3 test and the tool both read it) and the refusal copy is a first-class honest edge (E5, DE+EN). **This is a security-model + potential-new-dependency decision → founder-gated, not chosen unilaterally** (OS §4 Escalation: "Security model", "New dependencies with cost").

---

## Decision 3 — Structure-context strategy (R1) + token measurement skeleton (R6)

**Strategy: server-side parse → compact import-graph summary in context + on-demand `read_file`.** This directly extends the existing `project-context.ts` loader rather than replacing it. Today it injects up to 48k chars of *raw file contents*; that neither scales to a 15-file React project (it overflows and drops files "smallest-first," which is exactly wrong for reasoning about structure) nor exposes the *dependency edges* the agent needs ("wire the component into the router").

**Proposed shape (E1 build target, not built here):**
1. Server-side parse of each text source's `import`/`export`/`require` statements (a lightweight static scan — same class of work as the existing `referencedPaths` regex, extended from HTML attributes to ES-module specifiers; no full AST/transpile needed for v1).
2. Emit **one compact line per file**: `path (size) · imports: [resolved local edges] · exports: [names]`. The graph is the *map*; full contents are fetched **on demand** via the existing `read_file` tool (already hardened, already sandboxed by Wave-D).
3. Keep the static path unchanged: a project with only `index.html` still gets today's content injection.

**Token measurement — 15-file React sample (the ledger skeleton the prompt asks for):**

*Method (honest label — this is a FORMULA estimate from measured char counts of a representative graph, not a live model run; E1 replaces it with a real measurement, exactly as M2 was measured on a real project):* a representative 15-file Vite/React app (`index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/types.ts`, 5× `src/components/*.tsx`, 2× `src/hooks/*.ts`, `src/styles.css`).

| Approach | Chars in context | ~Tokens (chars÷4) | Fits budget? | Reasoning quality |
|---|---|---|---|---|
| **Today: full-content injection** (48k cap) | Real 15-file app ≈ 30–60k chars of source → **hits/overflows the 48k cap** | ~12k tok at cap, then **drops files** | No — silently sheds files smallest-first | Poor: agent sees *some* files, *no* edges |
| **Proposed: compact import-graph summary** | ~90–120 chars/file × 15 ≈ **~1.5k chars** | **~380 tok** for the whole project map | Yes, trivially (≈3% of the 48k budget) | Good: agent sees the whole graph; reads full bodies only for files it touches |

Headline for the ledger: **the structure map is ≈25–30× cheaper than full-content injection and, unlike it, actually fits a real multi-file project.** Per-turn cost becomes `graph summary (~hundreds of tok, scales with file *count* not file *size*) + on-demand read_file results (charged as tool-result input, same as today's read_file — no new billing path)`. Budget strategy: the graph is cheap and always injected; raw bodies are pulled only for the working set, so a 15-file project costs *less* context than today's blunt 48k dump, not more.

**Ledger skeleton (to be filled with a real measurement in E1's same commit — Methodik Gesetz 5):**

> **### M14 — Structure-context: import-graph summary (WAVE-E E1)**
> - **Trigger:** every turn in a project-bound chat/agent run **where a build-graph is parseable** (≥1 JS/TS/framework source). Static-only projects keep M2 unchanged.
> - **Tokens:** +Δ input = compact graph summary (~1 line/file; **FORMULA ~380 tok for a 15-file sample**, scales with file *count*) **replacing** part of the M2 raw-content dump; raw bodies fetched on demand via `read_file` (existing, no new path). **MEASURE on a real 15-file project in E1, as M2 was measured.**
> - **Billed to:** user allowance (same completion as M1/M2). Net effect vs M2 on multi-file projects: **likely negative** (map ≪ full dump).
> - **Knobs:** graph-summary format + per-file line budget (E1 file); the M2 `FILE_CONTENT_BUDGET_CHARS` still governs on-demand bodies.
> - **Status:** SKELETON (spike) → FORMULA+MEASURED in E1.

---

## Decision 4 — Framework set v1 (→ D-E3)

| Framework | Own-Vercel deploy fit (D-E1=A) | Cost/complexity | Verdict |
|---|---|---|---|
| **Existing static** (HTML/CSS/JS) | Already shipping; `framework: null`, byte-identical. **Must not regress.** | none | **Keep (baseline).** |
| **React + Vite** | Clean: `framework: "vite"` is a valid `projectSettings.framework` enum value; Vercel builds Vite SPAs out of the box on the user's own account. | Low. | **v1 — YES.** |
| **Next.js** | Vercel's native framework — but Next on *the user's own Vercel* via the API deployment path pulls in SSR/serverless-function behavior, `nodeVersion`, and output-mode questions that the current static-first `verifyDeployment` truth-gate wasn't built for. Higher blast radius on a live product. | Higher; needs its own deploy-verification story. | **v2 — DEFER** (the prompt explicitly allows "Next.js only if the own-Vercel deploy path supports it cleanly"; it does not yet, cleanly, without extra verification work). |

**Recommendation → D-E3 = React/Vite (v1) + existing static (kept). Next.js deferred to v2.**
This matches the prompt's own conditional and the R3 baseline ("real React (Vite) template + existing static; Next.js only if the own-Vercel deploy path supports it cleanly").

---

## FOUNDER GATES — decision table (HALT here; founder fills the Session-2 block)

| Gate | Question | Options | CC recommendation |
|---|---|---|---|
| **D-E1** | Where is a framework project built? | **A** deploy source → Vercel builds · B WebContainers (client) · C Railway build job | **A** — $0 COGS, *is* the own-Vercel model, smallest diff on an already-hardened path, no new code-execution sandbox, static path unchanged. |
| **D-E2** | Dependency policy? | **Allowlist (v1) + lockfile-pin** · full-npm · pin-only | **Allowlist v1 + pinning** — bounds the exact surface E3 probes; $0 vetting; expandable; full-npm founder-gated for later. |
| **D-E3** | Framework set v1? | **React/Vite + static** · +Next.js now | **React/Vite + static; Next.js → v2** — matches R3's own condition; Next's own-Vercel deploy path isn't cleanly covered by the current truth-gate yet. |

**Session-2 block for the founder to paste back (filled):**
```
FOUNDER DECISIONS: D-E1=<A|B|C> · D-E2=<allowlist|full-npm|pin-only> · D-E3=<react-vite|+nextjs>
```

---

## What Session 2 (BUILD) becomes if the founder accepts the recommendations
*(Preview only — not built, not committed as code this session.)*
- **E1** Structure context: extend `project-context.ts` with an ES-module import-graph parser → compact graph in context + on-demand `read_file`; **M14 ledger row measured on a real 15-file project, same commit.**
- **E2** React/Vite template + `create_project_structure` agent tool (few-shots: add component → wire import → build stays green; D-G beauty block applies to framework templates too).
- **E3** Allowlist dependency tool + `framework`-aware deploy (extend `vercel-service.ts` to send source + set `framework`, widen the publish poll deadline) + **adversarial test: agent asked to add a malicious/typosquatted package → refused** (coordinate with Wave-D's abuse-cap harness; don't duplicate the sandbox).
- **E4** The proof (verbatim): `Baue eine React-App: eine Aufgabenliste mit einer wiederverwendbaren TaskItem-Komponente, State im Parent, und stell sie live.` → real multi-file React project, TaskItem a separate importing component (code evidence), Vercel-built, own-Vercel live URL, runtime smoke green, deploy-verification VERIFIED. **Runs on the test account only** (`vinc.hafner3@`).
- **E5** Honest edges (DE+EN): build-failure copy, unsupported-framework limit, dependency-rejected ("nicht in der Freigabeliste / not in the allowlist").
- Next free migration if E-build needs one: **0096** (authored-never-applied).

---

## Self-review (OS §3, applied to a SPIKE)
1. **Evidence audit** — every repo claim above cites a file:line I opened this session (`project-context.ts`, `vercel-service.ts:230`, `tools.ts`, `templates.ts`, `_sprint/wave-d/MERGE_REPORT.md`); every external number cites a URL + fetch date (Sources below). The token figures are labeled **FORMULA/estimate**, not measured — honestly downgraded.
2. **Diffstat vs scope** — this session adds exactly one file (`_sprint/wave-e/SPIKE.md`). **No code, no accounts, no deploy, no migration.**
3. **Regression** — n/a (no code changed); the design's central constraint IS the LIVE-USER regression rule (static path byte-identical, framework additive behind `package.json` detection).
4. **Honesty sweep** — no user-facing strings shipped. WebContainers licensing stated at its true resolution: core is MIT, **but the production commercial API license is contact-sales / undisclosed** — not glossed as free.
5. **Ledger** — no consumption change this session; M14 **skeleton** provided for E1 to measure-and-fill in the same commit (Gesetz 5).
6. **Report completeness** — base SHA, per-decision tables, recommendations, founder gates, Honest-Limitations (below), founder actions (below), numeric estimates labeled as such.
7. **Steven question** — "would a skeptical reviewer, with only my evidence, reach my verdict?" The D-E1=A recommendation rests on a *verified* repo fact (the deploy already sends source as base64 with `framework:null`), so "let Vercel build" is a config delta, not a leap — yes. D-E2/D-E3 are recommendations *presented as gates*, not decisions taken — the honest posture.

## Honest Limitations
- **No live verification of the Vercel build-from-source path.** That "deploy `package.json` + `src/` with `framework:"vite"` → Vercel builds and serves" works is asserted from the **API docs** (valid `framework` enum, "the deployment begins building immediately", source-file inlining) — **not** from a real deploy this session (that requires the test account's Vercel token + a real POST = founder-gated, Session 2 / E4). Labeled UNVERIFIED-BY-DEPLOY.
- **Token numbers are FORMULA estimates** from representative char counts, not a live model run. E1 must measure on a real 15-file project (as M2 was) before the M14 row is anything but a skeleton.
- **WebContainers pricing is genuinely undisclosed** — "nominal charge above 10,000 req/mo" + "contact sales." I could not obtain a number; the honest recommendation (don't pick B) does not depend on the exact figure.
- **Vercel Hobby is non-commercial** by Vercel's ToS — irrelevant to Goblin's own COGS (users deploy to their own accounts) but a real constraint on *users* building commercial apps on Hobby; a plan-tier consideration owned by the founder, noted not decided.
- **Inline-file body size:** the current path inlines base64 into one POST. React source is tiny (<1 MB, no `node_modules` — Vercel installs), so inline stays fine; if E-build ever needs many/large source files, the SHA-upload-then-reference path is the documented fallback. Noted for E3.

## Founder actions
1. **Decide D-E1 / D-E2 / D-E3** (table above) and paste the filled `FOUNDER DECISIONS` block into a fresh Session-2 invocation of this prompt.
2. If D-E2 leans toward anything beyond the curated allowlist, confirm you accept the added supply-chain surface (Escalation: security model + new dependency).
3. For E4 in Session 2: confirm the **test account** (`vinc.hafner3@`) Vercel token is connected — the proof's live deploy runs there, never your personal account.
4. **No merge, no PR this session** — a spike HALTs at the decision table (CLOUD RIDER: branch+PR never merge; a SPIKE doesn't even build). The PR + E4 proof are Session-2 deliverables.

---

## Sources (URL + fetch date 2026-07-17)
- Vercel — Create a new deployment (REST API v13): inline `data`/`encoding` vs `sha`, `projectSettings.framework` enum incl. `"vite"`/`"nextjs"`, "begins building immediately QUEUED→BUILDING→READY", `skipAutoDetectionConfirmation`. https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment
- Vercel — Deployment/CLI limits: source-file upload 100 MB Hobby / 1 GB Pro; **15,000 max files**; Function body 4.5 MB (`FUNCTION_PAYLOAD_TOO_LARGE`). https://vercel.com/docs/limits · https://vercel.com/docs/functions/limitations
- Vercel — Build limits: **45-min max build**, **1 concurrent build on Hobby**, **6,000 build-min/mo Hobby**. https://vercel.com/docs/builds/managing-builds · https://deploywise.dev/blog/vercel-free-tier-limits-2026
- StackBlitz WebContainer — commercial licensing: production commercial use requires a license; "nominal charge" above **10,000 API req/mo**; enterprise = contact-sales, pricing undisclosed. https://webcontainers.io/enterprise · https://stackblitz.com/enterprise
- StackBlitz `webcontainer-core` LICENSE = **MIT** (the runtime shell only — distinct from the paid production API terms above). https://github.com/stackblitz/webcontainer-core/blob/main/LICENSE
