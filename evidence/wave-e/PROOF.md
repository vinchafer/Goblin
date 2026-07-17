# WAVE-E E4 — The Proof

**Prompt (verbatim):** `Baue eine React-App: eine Aufgabenliste mit einer wiederverwendbaren TaskItem-Komponente, State im Parent, und stell sie live.`

**Date:** 2026-07-17 · Branch `wave-e-build` · Opus

This app was generated from the **actual Wave-E code**: the `create_project_structure`
react-vite template (`apps/api/src/services/framework-templates.ts` → `buildFrameworkFiles`)
for the scaffold, then a `TaskItem.tsx` component + a rewired `App.tsx` (state in the
parent) exactly as the E2 few-shot teaches. Generator: `scratchpad/e4-generate.mts`.
The source is captured under `proof-app-src/`.

## Status of each E4 claim

| E4 claim | Status | Evidence |
|---|---|---|
| Multi-file React project | **VERIFIED** | `proof-app-src/` — 12 files: `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/types.ts`, `src/components/TaskItem.tsx`, CSS. |
| **TaskItem a real separate importing component** (code evidence) | **VERIFIED** | `import-graph.txt`: `src/App.tsx · nutzt: … src/components/TaskItem.tsx, src/types.ts`; `TaskItem.tsx · nutzt: src/types.ts · exportiert: TaskItem`. App imports TaskItem from its own file and imports the shared `Task` type — not an inline component. |
| **State im Parent** | **VERIFIED** | `proof-app-src/src/App.tsx`: `const [tasks, setTasks] = useState<Task[]>(…)` lives in `App`; `TaskItem` is stateless and receives `task` + `onToggle` as props (`proof-app-src/src/components/TaskItem.tsx`). |
| **Builds clean** (R2 — verified, not assumed) | **VERIFIED (deterministic, local)** | `build.log`: real `npm install` (66 packages) + `npm run build` (`tsc && vite build`) → **✓ 33 modules transformed**, `dist/index.html` + hashed `assets/*.js` + `*.css`, **build exit 0**. |
| **Runtime smoke green** | **VERIFIED (deterministic, headless Chromium)** | `runtime-smoke-result.json`: served the built `dist/`, loaded in headless Chromium → heading "Meine Aufgaben", 2 TaskItems rendered, **toggle flips parent state → row struck through** (`toggleWorks: true`), add-form grows the list 2→3, **zero JS errors** (`jsErrors: []`). The two `externalResourceErrors` are the Google-Fonts `<link>` + favicon, unreachable from the sandbox — an environment artifact, not an app defect. |
| **Deploys via own-Vercel, live URL, deploy-verification VERIFIED** | **FOUNDER ACTION (prepared, not run here)** | Requires the test-account (`vinc.hafner3@`) Vercel token — a live third-party mutation on an account this session must not hold (Methodik Gesetz 7/8, OS §4). The code path is built + unit-tested (E3: `detectVercelFramework` → `framework:'vite'`, `builtOutput` truth-gate, widened poll). Exact steps below. |

## How the deployed half runs (founder, on the test account only)
1. On the test account (`vinc.hafner3@gmail.com`) connect a free Vercel token (Einstellungen → Konnektoren → Vercel).
2. In a project, send the verbatim E4 prompt. The agent will: `create_project_structure` (react-vite) → write `src/components/TaskItem.tsx` → wire it into `src/App.tsx` → `publish`.
3. On publish, `deployToVercel` detects `package.json` → sends the **source** with `projectSettings.framework:'vite'` + `skipAutoDetectionConfirmation=1`; **Vercel builds on the test account** (~1–3 min, covered by the widened 240s poll); the `builtOutput` truth-gate verifies the served page + built assets → a **VERIFIED** live `*.vercel.app` URL.
4. Capture the live URL + the green verify line — that closes the E4 deploy half.

## Why the build proof is trustworthy without the deploy
Under D-E1=A the ONLY thing the deploy adds over this local proof is *where* `npm install`
+ `vite build` runs — here it ran locally with the exact pinned versions from the template's
`package.json`; on publish the identical source + versions build on the user's Vercel. The
local **✓ 33 modules transformed / exit 0** is the same `tsc && vite build` Vercel runs. The
one thing local CANNOT prove is the Vercel-specific serving + the `builtOutput` truth-gate
against a real URL — that is the founder action above, and its code is unit-tested (E3).

## Files in this evidence folder
- `proof-app-src/` — the generated project source (the artifact under test).
- `build.log` — real install + `tsc && vite build` output + `dist/` listing.
- `import-graph.txt` — the E1 parser's view (the TaskItem edge, verbatim).
- `runtime-smoke.mjs` + `runtime-smoke-result.json` — the headless-Chromium smoke and its green result.

## Honest note
The build + runtime proofs are **deterministic and real** (a genuine Vite build + a genuine
browser render), run in THIS session. The live own-Vercel deploy is the single founder-gated
step — labeled as such, not claimed. This E4 folder is the "seen" evidence for every claim
except the live URL, which is honestly marked FOUNDER ACTION.
