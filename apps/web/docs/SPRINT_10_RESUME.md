# Sprint 10 — Resume Document

> Single source of truth for resuming Sprint 10 in a fresh Claude Code session.
> Written 2026-06-09 (evening) after Phase B.1–B.5 completed. Read this first.

---

## §1 Status

Sprint 10 **Phase B.1 → B.5 complete**. The four pitch demo routes now render the
REAL Goblin production app shell (Header + Sidebar + tab bar + composer / editor /
preview) in a read-only `demoMode`, replacing the prior light-fidelity leaf-only
routes. When production changes, the pitch demos follow automatically.

**Push is GATED** on the authenticated smoke test (Sprint prompt §5.3). Nothing on
apps/web has been pushed. `justgoblin.com` runs unchanged.

---

## §2 Exact commit state

**apps/web repo** (`C:\Claude Projekte\12 - Goblin\Goblin`, branch `master`) — all **LOCAL ONLY**, in order:
- `20422e3` — B0: demo-mode architecture + production inventory docs
- `34a306c` — Checkpoint #1: §Suppressions checklist + stub-proxy unmount note
- `774ccf5` — B0.1: code-view scope decision (Option β)
- `8a06233` — B0.2: demo-mode infra + seed data (10 files, NO production touch)
- `f22d3a3` — **B.1–B.5: real production shell in /demo-* routes** (this sprint's work)

**Pitch repo** (`C:\Claude Projekte\12 - Goblin\Pitch`, branch `main`):
- `80fb381` — a11y C2 (svg-img-alt) — **PUSHED** to origin/main, Vercel deployed
- `5d5f889` — DeviceIframe fallback diagnosis (A.2) — **LOCAL ONLY**

Nothing on apps/web pushed. Production-App was never touched code-wise before f22d3a3
(and f22d3a3 only adds demoMode-gated branches: zero change when demoMode === false).

---

## §3 What f22d3a3 does — the 19 files

**Choke point (1 file):**
- `lib/supabase/client.ts` — single demo branch: `if (isDemoActive()) return createDemoSupabaseClient()`. The no-op stub resolves auth to DEMO_USER and queries to empty, neutralizing all ~45 inline `createClient()` auth calls at once. Inert for real users.

**Per-component `useDemoMode()` handler guards (6 files):**
- `components/layout/Header.tsx` — tab clicks, plus button, logo no-op in demo
- `components/header/AvatarMenu.tsx` — avatar click no-op (menu never opens)
- `components/layout/Sidebar.tsx` — nav / new-project / settings no-op
- `components/chat/standalone-chat.tsx` — send disabled, code-action button hidden
- `components/chat/ChatInput.tsx` — composer disabled, plus/model-pill inert, realtime subscribe skipped
- `components/preview/preview-tab.tsx` — `displayUrl` prop (pretty URL over the `data:` URI) + Vercel protection banner hidden in demo

**Shell suppressions (1 file):**
- `components/app-shell/dashboard-shell.tsx` — `demoMode` read; first-run-tour effect + settings deep-link effect guarded off

**lib/api.ts per-caller fetch guards (4 files) — see §5:**
- `lib/hooks/useUser.ts` — skip `/api/users/me` (derive plan from seed metadata)
- `components/app-shell/trial-banner.tsx` — skip `/api/users/me/trial`
- `components/sidebar/SidebarUsage.tsx` — skip `/api/users/me/usage`
- `components/layout/Sidebar.tsx` (RecentChats) — skip `/api/chat-sessions` (also in handler guards above)

**Global side-effect suppressions (2 files):**
- `lib/analytics.ts` — `initAnalytics()` no-ops in demo (no pageview)
- `hooks/useKeyboardShortcuts.ts` — global key listener not registered in demo (Cmd/K etc. inert)

**Infra safety (1 file):**
- `lib/demo/demo-flag.ts` — `setDemoActive()` is now client-only (no SSR singleton contamination across concurrent requests)

**DemoApp + routes (5 files):**
- `components/demo/DemoApp.tsx` — NEW. Wraps DemoProviders + DashboardShell; seeds chatProjectId / previewUrl / activeTab; renders the active view (chat / code-β / preview)
- `app/demo-chat/page.tsx` — `<DemoApp view="chat" viewport="desktop" />`
- `app/demo-chat-mobile/page.tsx` — `<DemoApp view="chat" viewport="mobile" />`
- `app/demo-code/page.tsx` — `<DemoApp view="code" viewport="desktop" />`
- `app/demo-preview/page.tsx` — `<DemoApp view="preview" viewport="desktop" />`

(Seed data files `lib/demo/*` and `components/demo/DemoProviders.tsx` landed earlier in 8a06233.)

---

## §4 Architecture reminder

**Pattern:** choke-point auth + prop-seed data + per-component `useDemoMode()` guards.
NOT hook substitution (production has no data-hook layer — ~47 inline fetch, ~45 inline
createClient). NOT a global fetch shim (rejected).

- One demo-aware `createClient()` in `lib/supabase/client.ts` neutralizes all auth.
- Prop-driven components get seed via props (`StandaloneChat.initialMessages`, etc.).
- Handlers disabled per-component via `useDemoMode()` / `demoMode` prop.

**Code-view scope = Option β:** real DashboardShell chrome + real `CodeEditor` leaf
(Navbar.tsx, readOnly). NOT the deep multi-session `CodeWorkspace` (SessionPane /
thread / diff-review). ~95–99% of visible pixels at a 4-second glance. Full-fidelity
Option α deferred to Sprint 11 (needs Storybook / documented hook mock shapes).

**Suppressions in demo mode (all active, per §6 checklist):**
- First-run tour — not triggered (effect guarded off)
- Command palette (Cmd/Ctrl+K) — listener not registered
- Settings sheet — auto-open suppressed, gear handler no-op
- Auto-focus on composer/inputs — suppressed (composer disabled)
- Auto-scroll — initial OK, continuous suppressed (messages never change in demo)
- Toast notifications — provider renders empty (no toast fires; handlers disabled)
- Realtime subscriptions (Supabase channels) — not subscribed (guard + stub no-op)
- Polling intervals — none start (data fetches guarded)
- Service-worker / push-permission prompts — not triggered (hook not in demo tree)
- Analytics — none fired, not even pageview

**Hard Rule #12:** production components are NEVER forked. demoMode-prop or
`useDemoMode()`-hook only. Zero behavior change when `demoMode === false` (every real
user, always).

---

## §5 lib/api.ts finding (important for future work)

`lib/api.ts` constructs its **OWN** `createBrowserClient` at module load — it does NOT
go through the `lib/supabase/client.ts` choke point. So `getAuthHeaders()` /
`apiGet` / `apiPost` / `apiStream` are **not** auto-neutralized by demo mode.

→ All apiGet/apiStream callers that fire on mount were guarded individually:
useUser, trial-banner, SidebarUsage, Sidebar RecentChats, preview connectors.

**If future work adds new API callers, they must also be guarded** (e.g.
`if (isDemoActive()) return;` before the fetch) — otherwise they will fire real `401`
network calls inside demo routes, violating Sprint 10 §7 ("no API calls in demo
routes, read-only static").

---

## §6 Pre-flight evidence already GREEN

- `pnpm typecheck` (apps/web) → **exit 0**, no errors
- `pnpm build` (apps/web) → **exit 0**, 4 demo routes prerendered as `○ (Static)`
- Local prod server (`PORT=3100 pnpm start`):
  - `/demo-chat`, `/demo-chat-mobile`, `/demo-code`, `/demo-preview` → all **200**
  - Production shell markup present in SSR HTML: `goblin-header`, `goblin-tab-pills`,
    `chat-scroll`, `data-demo-viewport`, `Injected` + `Navbar` (code), `Projekt-Vorschau`
    + `portfolio.vercel.app` (preview display URL, not the data: URI)
  - `/dashboard` → **307 → /login** — proves the choke point does NOT leak into real
    routes (real auth path untouched)

(Project name "Portfolio" is set in a client effect, so it appears after hydration,
not in raw SSR HTML — expected.)

---

## §7 What MUST happen tomorrow BEFORE push (critical)

1. **Smoke test (Sprint prompt §5.3):** locally `pnpm dev` (port 3000), Vincent logs
   into the REAL app, opens a project, sends a REAL message → must work. This proves
   the choke point didn't silently break real auth/data for real users.
2. **If smoke test GREEN:** push apps/web `f22d3a3` → `origin/master` → Vercel deploy
   (~60s).
3. **If smoke test RED:** STOP, report, emergency rollback ready (`git reset --hard
   8a06233`, see §9).

---

## §8 After successful push

- Vincent's Pitch-reviewer Claude (in claude.ai) verifies the 4 live URLs via Chrome-MCP:
  - https://justgoblin.com/demo-chat-mobile?theme=pitch
  - https://justgoblin.com/demo-chat?theme=pitch
  - https://justgoblin.com/demo-code?theme=pitch
  - https://justgoblin.com/demo-preview?theme=pitch
- If all four show the full production look (Sidebar, Header, Composer, tab-bar, real
  styling) and are non-interactive → **Phase C** (DeviceIframe fix in the Pitch repo,
  ~2h) + **Phase D** (Sprint 9 Lighthouse leftovers: WCAG 2.5.3 hero CTA, color-contrast
  2 nodes, optional perf, ~2h).
- If any route is off → iterate before Phase C.

---

## §9 Emergency rollback

```
cd "C:\Claude Projekte\12 - Goblin\Goblin"
git reset --hard 8a06233
```

Resets apps/web to the B0.2 state (demo infra + seed, NO production touch). No risk to
justgoblin.com because nothing was pushed. After rollback the demo routes revert to
their prior leaf-only form (still functional in the pitch).

---

## §10 Resume command for tomorrow

> "Lies apps/web/docs/SPRINT_10_RESUME.md. Wir machen den Smoke-Test gemeinsam: starte
> pnpm dev auf Port 3000, ich logge mich ein und schicke eine Message. Bei grün: push
> f22d3a3."
