# F-W2-a — Sidebar Recovery to the Live Build Window — NAV MAP & PLAN

Date: 2026-06-21 · Branch `fw2a-validation-2026-06-21` · Phase A (map only, no edits)

## The defect (living half of W2)
W2 made the build/preview window persist across navigation (`goblin:wsTab:<projectId>`
restore in `project-workspace.tsx`). But clicking a project in the **sidebar** still
navigates to the **hub** (`/dashboard/project/<id>`), not the live `/work` surface. After
a build, the obvious path back (sidebar) lands on the hub → the running/finished build
window reads as "gone." Recovery exists (hub → "Letzte Code-Sessions" card) but is
non-obvious.

## 1. How the sidebar project entry builds its nav target

`apps/web/components/layout/Sidebar.tsx` — the project row's `onClick` calls
`navigate(`/dashboard/project/${p.id}`)` in **two** places:
- **Desktop** rail: line **280**.
- **Mobile** drawer: line **460**.

`navigate(path)` (lines 124–128): `router.push(path)` + `onClose?.()`, inert in demo mode.
Both are hard-coded to the **hub** route. No per-project resolution today.

## 2. What state is available at sidebar-render time WITHOUT a fetch

- The `projects` array is fetched server-side in `app/dashboard/layout.tsx` as
  `supabase.from('projects').select('*')` — **no code-session join**. So the project
  row object carries `{ id, name, color, updated_at, last_active, description }` and does
  **NOT** know its last `code_sessions` id.
- **BUT** the build view-state is already on the client: `project-workspace.tsx` writes
  `sessionStorage('goblin:wsTab:<projectId>')` = `chat | code | preview` on every tab
  change (line 55). Sidebar is a `'use client'` component → it can read this at render
  with **zero fetch, zero schema**.
- Resolving the *specific* last session id (`?session=<id>`) would require either the
  hub's fetch (server) or a new client fetch (new pipeline) — **out of the contained
  scope.** Not needed: `/work?tab=code` without `?session=` already loads the most recent
  session by default (`useCodeSessions`), and the hub session card remains the path to a
  *specific* older build.

## 3. Blast radius of changing the sidebar target

Places that rely on "sidebar project → hub" as the landing:
- The sidebar rows themselves (Sidebar.tsx:280, :460) — the only call sites.
- `activeProjectId` highlight logic, `RecentChats`, header tabs — all derive from the
  **URL** (`/project/[id]` regex in `dashboard-shell.tsx:79`). `/work` is still a
  `/project/[id]/...` route, so the active-project highlight, header Code·Preview tabs,
  and settings deep-links all keep working under either target. **No regression.**
- The hub (`/dashboard/project/<id>`) stays reachable for projects with **no** build
  view-state, and via the header project-name and direct URL. **Hub is NOT made
  unreachable.**

## Chosen approach — per-project smart-resume (contained, no blanket flip)

Resolve the sidebar link **per project** at render, NOT globally:
- Read `sessionStorage('goblin:wsTab:<id>')`.
  - If `code` or `preview` → `navigate('/dashboard/project/<id>/work?tab=<persisted>')`
    (lands back on the live build/preview window).
  - Else (no build view-state, or `chat`) → `navigate('/dashboard/project/<id>')`
    exactly as today (hub stays the default).
- Implemented as a tiny client helper in Sidebar; applied to both the desktop (line 280)
  and mobile (line 460) row handlers. No schema change. No new fetch/pipeline. W2
  tab-restore behavior untouched (we only *read* the key it already writes). No new user
  copy → EN/DE unaffected.

### Honest limitation (documented, not hidden)
`goblin:wsTab` is **sessionStorage** — scoped to the browser-tab session. After a full
browser restart the key is gone → the sidebar falls back to the hub, and recovery is the
hub session card (already working). This matches the existing `/work` restore, which is
also sessionStorage-scoped, so behavior stays **consistent** across both surfaces.

**Optional enhancement (founder call, NOT in the minimal change):** mirror `wsTab` to
`localStorage('goblin:lastWsTab:<id>')` in `project-workspace.tsx` and read it as a
fallback in both the sidebar resolver and the workspace restore. That would make
"build today → click the project tomorrow → land on the build window" work across
browser restarts. It touches 2 files, still no schema. Flagged for approval rather than
bundled, because it slightly changes the W2 restore semantics (cross-session, not just
cross-nav).

## Verdict
**CONTAINED.** The change fits entirely in the sidebar-link resolution layer (read an
existing client key) + does not alter nav semantics app-wide and does **not** make the
hub unreachable. Safe to proceed to Phase B on approval.
