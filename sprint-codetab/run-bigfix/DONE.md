# GOBLIN — Loop test + two file features + deep test-and-fix (autonomous run)

Date: 2026-06-15 · Account: vinc.hafner3@gmail.com (sanctioned test account,
magic-link/password via service role — never a credential/OAuth login) · Prod:
https://www.justgoblin.com · API: Railway · Sequence: WS-A → WS-B → WS-C.

Status line: **typecheck PASS · vitest 84 GREEN (incl. the new loop net) · prod
build PASS · origin/master == HEAD · deployed.**

---

## WS-A — the build-loop safety net (the net for WS-C)

**What it asserts.** The test that would have caught the `style.css` vs
`styles.css` deploy-stale bug. It drives the real loop functions and asserts on
the **real persisted deploy-source bytes** (the `file-storage` in-memory backend,
active whenever `STORAGE_*` env is absent — i.e. in CI — IS the deploy source the
live page loads).

`apps/api/src/__tests__/build-loop.test.ts` (4 tests, GREEN):
- a model turn that writes CSS named `styles.css` while `index.html` links
  `style.css` → after `reconcileBlockPaths` + `/save`, **`getFile(project,'style.css')`
  carries the edit** and **no orphan `styles.css` exists** (asserted on real bytes).
- **regression proof**: WITHOUT the reconcile step the edit orphans into
  `styles.css` and the linked `style.css` stays stale white — the exact bug.
- edit-in-place on a correctly-linked file updates the same deploy source.
- multi-stylesheet (ambiguous) project is left alone — reconcile stays conservative.

`apps/api/src/__tests__/move-to-project.test.ts` (2 tests, GREEN) — WS-B.1 data
safety (copy-before-delete, no overwrite) on the same real backend.

**A.1 provisioning gap.** `tests/e2e/42-build-loop.spec.ts` (`@local-only`):
stands up a deterministic project via the service role, seeds the exact orphan
scenario, drives a real `/messages` → `/save` through the live API, and asserts
`style.css` (the linked deploy source) carries the edit with no orphan. This is
the piece that lets a spec drive a *real* project's build loop.

**A.3 how to run / CI.**
- CI: `.github/workflows/ci.yml` → new `api-tests` job runs `pnpm --filter
  @goblin/api test` on every push/PR (no `STORAGE_*` → memory backend = real
  deploy source). **GREEN.**
- Local net: `cd apps/api && npx vitest run` → 84 passed.
- Local real-project driver: `pnpm test:e2e:local` (needs local stack + a working
  model on the test account).

The live-Vercel-render step stays a documented manual check (hard to automate);
the persistence + reconcile are asserted automatically.

Loop shape (`hydrateSessionFiles` / `/save` / `/deploy`) **untouched** — now
test-backed.

---

## WS-B — two file features

### B.1 — "In anderes Projekt verschieben" (cross-project move)
- **API** `POST /api/projects/:id/files/move-to-project`
  (`apps/api/src/routes/projects.ts:699`): owns-both-projects check → copy into
  target → **verify the bytes landed → only then delete the source** (data-safe);
  409 on a name clash in the target (no silent overwrite). Publish loop untouched.
  **Verified live on Railway** (safe same-project probe → exact validation error
  `"Quell- und Zielprojekt sind identisch"`).
- **UI** `apps/web/components/files/FileExplorer.tsx`: ⋮-menu item *"In anderes
  Projekt"* opens a picker of the user's other projects; copy-then-remove with a
  conflict toast.
- **Test** `move-to-project.test.ts` (GREEN).

### B.2 — "Erstellt" + "Zuletzt gepusht" columns
- **Migration `0066_project_file_meta.sql`** — **FOUNDER ACTION: apply via
  Supabase SQL Editor.** `project_file_meta(project_id, path, created_at,
  last_pushed_at)`, unique per (project,path), RLS read-own.
- `created_at` stamped on create / PUT / upload / cross-project move;
  `last_pushed_at` stamped on GitHub push (`github.ts`, best-effort).
- `files-tree` enriches entries; explorer shows **Erstellt + Gepusht** columns,
  honest **"—"** for untracked / pre-migration files (never faked). Columns hide
  when the pane is cramped (≤1200px), size hides ≤560px.
- **Verified live on Vercel (desktop):** both columns render with honest "—"
  (migration pending) — screenshot `shots/r322/d-proj-files.png`.

---

## WS-C — deep test-and-fix (2 substantive rounds, prod-verified)

Method: authenticated prod walk as vinc.hafner3 at 390 mobile + 1366 desktop,
real screenshots + console/page-error capture (`sprint-codetab/run-bigfix/walk.mjs`,
`verify.mjs`). Greeting confirmed **"GUTEN MORGEN, VINC.HAFNER3"** (handle, never
personal).

### Fixed (GREEN, prod-verified)
| # | Bug | Sev | Fix | Verify |
|---|-----|-----|-----|--------|
| 1 | `/dashboard` threw React **#418 hydration** on every load — greeting used `new Date().getHours()` + `Math.random()` during render (SSR ≠ client). Also tripped on the settings sheet (renders on /dashboard). | P1 | `dashboard/page.tsx` — compute greeting post-mount via effect; empty span first paint. | `shots/r2` — **#418 gone** on dashboard/settings/help/about; greeting renders. |
| 2 | Sidebar **"See all chats →"** English in a German app. | P2 | → "Alle Chats →" (`Sidebar.tsx`). | deployed |
| 3 | **`/help` entirely English** while app defaults to German (`useLang`→'de'). | P1 | Converted to shared i18n hook, full DE+EN (`help/page.tsx`). | `shots/r2/help.png` — fully German. |
| 4 | **`/about` entirely English.** | P2 | Bilingual via `useLang` (client component) (`about/page.tsx`). | deployed |
| 5 | **`/usage` stuck on "Lade …" forever AND showed raw "API error 429"** when the fetch failed (loader keyed on `loading \|\| !data`). | P2 | Loader only while loading; errors fall through (`usage/page.tsx`). | code + build |
| 6 | Raw **"API error 429"** surfaced to users from the shared fetch helpers. | P2 | `api.ts` friendly German per status (429/5xx/401) — server msgs still win for real 4xx. | code + build |

### Investigated → not a bug
- **429 storm** during the rapid multi-page sweep (11×/page on later surfaces):
  **cumulative rate-limit artifact of the harness**, not a product bug — an
  isolated fresh load of the same surface returned **0** 4xx
  (`probe-429.mjs`). The walk was re-paced to confirm.

### AMBER (observed, not cleanly reproduced → not fixed blindly)
- **Settings → Profil email shows "—"** in one sweep capture (`shots/r1b/m-settings.png`).
  Source is `value={user.email} || '—'` — empty only when the `user` prop hadn't
  populated, which coincided with the rate-limited sweep. Could not reproduce on
  an isolated load (the `#profile` sheet doesn't open via direct hash nav). Left
  for a founder spot-check rather than a blind fix.

### NEEDS-FOUNDER
- **Apply migration `0066_project_file_meta.sql`** (Supabase SQL Editor) → B.2
  columns populate with real dates; until then they honestly show "—".
- **`/pricing` (and public landing) is English.** It's a *public, pre-login*
  marketing page where no lang preference exists yet — likely deliberate (marketing
  EN, app DE). Not touched; also a **STOP exception** (pricing/strategy). Flag for
  a founder call on whether public pages should localize.

---

## Guards confirmed
- Loop shape (`hydrateSessionFiles`/`/save`/`/deploy`) untouched + now test-backed.
- Migration **written, not applied** (founder action, flagged).
- No invented data; no prod DB writes (move endpoint verified via safe same-project
  probe only); vinc.hafner3 sanctioned account only; no autonomous OAuth/credential
  login.
- Commits prefixed per workstream; **origin/master == HEAD**; deployed (Vercel +
  Railway auto-deploy on push — WS-B.1 endpoint + WS-B.2 columns + WS-C round-1
  fixes all confirmed live).

## Commits
- `d78bdb5` WS-A build-loop net + CI
- `cac7802` WS-B move + columns + migration 0066
- `acb1d26` WS-C r1 (#418, i18n help/about/sidebar)
- `951252d` WS-C r2 (usage loader + friendly API errors)
