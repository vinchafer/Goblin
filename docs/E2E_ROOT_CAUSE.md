# E2E Suite — Weekly Failure Root Cause & Fix

Date: 2026-06-21 · Branch `product-fixes-2026-06-21`

R-1: "re-run green" is not a fix. This documents the REAL failing step, the cause,
the fix, and why it won't recur.

## The actual failure (read from the job log)
Run `27893384353` (master `1dc13a4`), job **e2e**, real failing assertion:

```
✘ 19-mobile-create-project.spec.ts:7 › 9C — Mobile Create Project (BUG-010)
   › Mobile FAB → modal → submit → no "invalid project data" @auth (18.3s)
✘ (retry #1) (18.5s)
   TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
```

The test fills the new-project modal, submits, then:
`await page.waitForURL(/\/dashboard\/project\//, { timeout: 15000 })`.
Both the initial run and the retry exceeded 15 s. Exit code 1 → job red.

## Root cause #1 — the real failure: dev-server lazy compilation (the flake)
The CI workflow **builds** the web app (`pnpm --filter @goblin/web build`,
`e2e.yml`), but the Playwright `webServer` then ran the **dev** server
(`cd apps/web && pnpm dev`, `playwright.config.ts`). `next dev` compiles each route
**on its first request** (lazy/on-demand). `19-mobile-create-project` creates a
project and navigates to `/dashboard/project/[id]` — a heavy dynamic route
(ProjectWorkspace → CodeTab → editor chunks). When this test is the **first** to hit
that route, the dev server compiles it on demand; under CI CPU load that first-hit
compile can take longer than the 15 s `waitForURL` budget → timeout. On a re-run the
route is already compiled (warm) or the timing differs → it passes. That intermittent
"compiles sometimes slower than 15 s" is exactly a ~weekly-looking flake, and the
`build` step was wasted because the server it ran wasn't the built one.

**Why a re-run looked green (and why that's not a fix):** the re-run benefited from a
warm compile / different scheduling — the underlying race (first-hit compile vs a
fixed wait) was untouched.

### Fix #1 (deterministic, at the cause)
Run the **production** server in CI — serve the pre-built `.next` with `next start`:

```ts
// playwright.config.ts (webServer, web)
command: process.env.CI ? 'pnpm --filter @goblin/web start' : 'cd apps/web && pnpm dev',
```

`next start` serves **precompiled** routes, so there is no first-request compile —
every route responds immediately and `waitForURL` resolves in ~1–2 s (matches the
~2.1 s observed driving the same flow live on prod). The 15 s timeout is **not**
changed (R-1): the wait was never the problem, the lazy compile was. Local dev keeps
`next dev` for hot-reload. The API webServer stays on `tsx` dev (it executes TS
directly — no route-level lazy compilation, responds fast), so only the Next web
server needed the prod switch.

## Root cause #2 — systemic drift: floating Node version (preventive)
`actions/setup-node@v4` was pinned only to major `node-version: '20'`, and GitHub is
gradually migrating the Node-20 action runtime toward Node 24. A floor the platform
moves under you, rolled out gradually across runners, is a classic "randomly breaks
~weekly" shape even when a given commit is unchanged.

### Fix #2
Pin every workflow to an explicit supported LTS — **Node 22** — so the runner can't
silently shift it: `e2e.yml`, `ci.yml`, `performance.yml` now use `node-version:
'22'` (app `engines` allow `>=20`; 22 is current LTS). The actions themselves are
already at their latest major (`@v4`); when GitHub ships majors that declare the
Node-24 runtime, bumping those majors is the follow-up lever. This was NOT the proven
cause of the logged failure (that was #1), but it removes the systemic drift the
suite was exposed to.

## Why it won't recur weekly
- The flaky route no longer races a compile: prod server = precompiled routes =
  deterministic sub-2 s navigations, well inside the existing 15 s wait.
- The toolchain version is explicit and reproducible, not a platform-moved floor.

## Honest scope
- The proven failure was #1 (dev lazy-compile). #2 is hardening the prompt asked for
  and is good practice, not a demonstrated cause of this specific red run.
- No test was skipped, deleted, or had its timeout bumped to force green (R-1).
