# Demo Mode Architecture (Sprint 10 §B.0 proposal)

How the **real Goblin production components** render inside the Pitch's §04/§05
device frames (and, later, the justgoblin.com landing page) in a read-only "demo"
state — without forking or duplicating any production component.

> **Status: PROPOSAL for Vincent Checkpoint #1.** No production code changed yet.
> Adapted from the Sprint 10 §B.0 template to the *actual* codebase shape
> documented in `PRODUCTION_INVENTORY.md` (no data-hook layer; inline fetch/auth;
> server/client render split).

---

## 0. The two facts that shape everything

1. **No data-hook layer.** 47 files call `fetch()` inline, 45 call
   `createClient()`/`getSession()` inline. There is no `useConversation` /
   `useProject` / `useAuth` to override (the prompt's B.3 assumption). So
   substitution happens at **two central choke points + props**, not at a hook
   layer.
2. **Server/client split.** The real workspace data pages
   (`app/dashboard/chat/[sessionId]`, `app/project/[id]`) are **server components**
   that auth + query Supabase server-side. A client context can't intercept them.
   → Demo routes render the **client presentational components directly with seed
   props**, bypassing the server data pages (which stay untouched).

---

## 1. The `demoMode` signal — context, with a prop alias

`demoMode` reaches components two ways, both defaulting to off (zero production change):

```tsx
// lib/demo/demo-mode-context.tsx
"use client";
import { createContext, useContext } from "react";
export const DemoModeContext = createContext<boolean>(false);
export const useDemoMode = () => useContext(DemoModeContext);
```

- **Deep components** (Sidebar, Header, model-switcher, file tree, message rows)
  read `useDemoMode()` — no prop drilling.
- **Top components** that already take props may also accept `demoMode?: boolean`
  for clarity, defaulting to `false`.

Usage in a production component (the only shape of change, repeated surgically):

```tsx
const demoMode = useDemoMode();
// disable interaction
<button onClick={demoMode ? undefined : handleSettings} disabled={demoMode}>…</button>
// neutralize nav
<a href={demoMode ? undefined : href}
   onClick={demoMode ? (e) => e.preventDefault() : undefined}>…</a>
```

When `demoMode === false` (every real user, always), behavior is byte-identical.

---

## 2. Choke point A — auth (one file neutralizes all 45 call sites)

All 45 inline auth calls import `createClient` from `@/lib/supabase/client`.
Instead of guarding 45 sites, make that one factory demo-aware:

```tsx
// lib/supabase/client.ts  (surgical addition)
import { isDemoActive } from "@/lib/demo/demo-flag";
import { createDemoSupabaseClient } from "@/lib/demo/demo-supabase";

export function createClient() {
  if (isDemoActive()) return createDemoSupabaseClient(); // returns DEMO_USER session, no network
  /* …existing production client… */
}
```

`createDemoSupabaseClient()` returns a stub whose `auth.getSession()` /
`getUser()` resolve to `DEMO_USER` (so no component redirects to `/login`), and
whose `.from(...).select()` resolves to `[]` (demo views get their data via props,
not via these stray queries). This is the single most important de-risking move:
**it removes the "one missed auth guard → /login redirect" failure mode entirely.**

`isDemoActive()` (`lib/demo/demo-flag.ts`): a module-level flag set synchronously
by `DemoProviders` on mount, with a `window.location.pathname.startsWith("/demo-")`
fallback. Client-only; SSR guarded.

---

## 3. Choke point B — data, via props (not a fetch monkey-patch)

The demo views are **prop-driven at the top**, so seed data is injected as props
— no global `fetch` patching:

- `StandaloneChat({ initialMessages })` ← `DEMO_CONVERSATION`
- `DashboardShell({ projects, userName })` ← `[DEMO_PROJECT]`, `DEMO_USER.name`
- `CodeEditor({ content, filename, readOnly })` ← `DEMO_CODE_FILES[0]`
- `preview-tab` ← `DEMO_PREVIEW_HTML`

The few **inline** fetches that aren't prop-fed (model health poll, usage
indicators, trial banner) are guarded with `if (useDemoMode()) return;` /
short-circuit to a seed constant — ~5–8 sites. They already `catch` and degrade,
so even an un-guarded one fails soft (no crash), but we guard them for a clean
static surface.

> Rejected alternative: monkey-patching `window.fetch`. Too broad, hard to reason
> about, and unnecessary because the top components are prop-driven.

---

## 4. Seed data files (typed against production types)

```
lib/demo/
├── demo-flag.ts            — isDemoActive() / setDemoActive()
├── demo-supabase.ts        — createDemoSupabaseClient() stub
├── demo-user.ts            — DEMO_USER
├── demo-project.ts         — DEMO_PROJECT (the "Portfolio" project)
├── demo-conversation.ts    — DEMO_CONVERSATION (dark-mode-toggle exchange)
├── demo-code-files.ts      — DEMO_CODE_FILES (Navbar.tsx, …)
├── demo-preview.ts         — DEMO_PREVIEW_HTML (portfolio page)
├── demo-mode-context.tsx   — DemoModeContext / useDemoMode
└── index.ts                — re-exports
```

All seed typed against production types (`Project`, `StandaloneMessage`, …). If a
production type changes incompatibly, `tsc` fails the build → drift is caught
mechanically (requirement #2 satisfied at the type level, not just at runtime).

---

## 5. DemoApp + DemoProviders

```tsx
// components/demo/DemoProviders.tsx
"use client";
export function DemoProviders({ children }: { children: ReactNode }) {
  useEffect(() => { setDemoActive(true); return () => setDemoActive(false); }, []);
  return (
    <DemoModeContext.Provider value={true}>
      <ThemeProvider>            {/* lib/theme.tsx */}
        <AppProvider>            {/* contexts/app-context.tsx — UI state */}
          <BuildProvider>        {/* contexts/build-context.tsx */}
            {children}
          </BuildProvider>
        </AppProvider>
      </ThemeProvider>
    </DemoModeContext.Provider>
  );
}
```

```tsx
// components/demo/DemoApp.tsx
"use client";
export function DemoApp({ view, viewport }: {
  view: "chat" | "code" | "preview";
  viewport: "mobile" | "desktop";
}) {
  return (
    <DemoProviders>
      <DashboardShell projects={[DEMO_PROJECT]} userName={DEMO_USER.name}>
        {view === "chat"    && <StandaloneChat sessionId="demo" initialMessages={DEMO_CONVERSATION} />}
        {view === "code"    && <CodeWorkspace seed={DEMO_CODE_FILES} />}
        {view === "preview" && <PreviewTab html={DEMO_PREVIEW_HTML} />}
      </DashboardShell>
    </DemoProviders>
  );
}
```

`viewport` drives a wrapper data-attribute / forced width so the shell renders its
mobile vs desktop form (the shell already switches on a media query; demo forces
it deterministically).

---

## 6. Demo routes become one-liners (B.5)

```tsx
// app/demo-chat-mobile/page.tsx → <DemoApp view="chat" viewport="mobile" />
// app/demo-chat/page.tsx        → <DemoApp view="chat" viewport="desktop" />
// app/demo-code/page.tsx        → <DemoApp view="code" viewport="desktop" />
// app/demo-preview/page.tsx     → <DemoApp view="preview" viewport="desktop" />
```

Everything below is the real production tree in `demoMode`.

---

## Production files touched (Checkpoint #1 approval list)

**Choke points (high-leverage, 2 files):**
- `lib/supabase/client.ts` — demo-client branch (~6 LOC).

**Presentational components — `useDemoMode()` guards + handler-disable:**
| File | Change | ~LOC |
|------|--------|------|
| `components/app-shell/dashboard-shell.tsx` | guard inline supabase + disable modals/nav | 15–25 |
| `components/layout/Header.tsx` | disable handlers, demo identity | 10–20 |
| `components/layout/Sidebar.tsx` | disable nav, seed project list | 10–20 |
| `components/chat/standalone-chat.tsx` | disable send/composer (seed already via prop) | 8–12 |
| `components/code/CodeWorkspace.tsx` | accept `seed`, disable actions | 15–25 |
| `components/code/*` (3 fetch/auth files) | guards | 5–15 ea |
| `components/preview/preview-tab.tsx` | accept `html`, disable | 10–15 |
| `components/sidebar/*` (1), `components/files/*` (1) | guards | 5–10 ea |
| `components/app-shell/{model-switcher,projects-list,trial-banner,usage-indicators}.tsx` | short-circuit polls | 5–10 ea |

**New files:** `lib/demo/*` (9), `components/demo/{DemoApp,DemoProviders}.tsx` (2).

**Hooks needing demo short-circuit:** none exist as hooks — handled via choke
points + props (see §0, §3). `hooks/useKeyboardShortcuts.ts`: guard to no-op in
demo (1 site).

**Context providers needing demo values:** `AppProvider`, `BuildProvider`,
`ThemeProvider` — reused as-is inside `DemoProviders` (no edits; demo-safe by
default). New: `DemoModeContext`.

**Estimated total: ~20–25 production files, ~150–300 LOC. Zero behavior change
when `demoMode === false`.**

---

## Risks

1. **DashboardShell expects more than props.** It reads `useApp()` and does inline
   work (settings sheet, command palette, first-run tour via `dynamic`). Demo must
   ensure these don't auto-open or fetch. Mitigation: `demoMode` guards on the
   auto-open effects; `FirstRunTour` gated off in demo.
2. **CodeWorkspace may not currently accept seed props** (it likely fetches a code
   session by id). Adding a `seed` prop is the largest single change; if its
   internals are deeply fetch-coupled, this file alone could be 30–40 LOC. Flag.
3. **preview-tab** renders a project preview URL/iframe — demo needs a static
   `html` path. Verify it can render inline HTML, not only a remote URL.
4. **Mobile vs desktop determinism** — the shell switches on `matchMedia`; inside a
   sized iframe the width is correct, but forcing the form deterministically may
   need a demo viewport override prop.
5. **Demo supabase stub surface** — must cover every method the 45 call sites use
   (`auth.getSession`, `auth.getUser`, `from().select().eq().single()`,
   `.order()`, realtime `.channel()`?). If a call uses a method the stub lacks, it
   throws. Mitigation: stub returns chainable no-op proxies resolving to empty.
6. **No live browser verification** until Chrome remote debugging is enabled —
   Checkpoint #2 relies on Vincent's eyes.

---

## Decision needed at Checkpoint #1

- **Substitution strategy:** approve **choke-point auth + prop-seed data +
  per-component handler guards** (this doc), vs. the prompt's hook-substitution
  (not feasible — no hooks) vs. a global fetch shim (rejected, §3).
- **Scope:** full production chrome (Header/Sidebar/shell) — heaviest, where the
  auth/fetch complexity lives — vs. partial-real (real Message/CodeEditor leaves,
  current state, static chrome). This doc assumes **full chrome**.
- **Approve the touched-file list** above, or exclude any component.

> **Checkpoint #1 decision (approved 2026-06-08):** Architecture ✓. Scope =
> **full chrome** ✓. Suppressions checklist below is binding for B.1.

---

## Suppressions checklist (binding for B.1)

Every item below is gated on `demoMode === true` and must be a no-op / not-rendered
in demo, with zero change when `demoMode === false`:

- [ ] **First-Run-Tour** — not triggered, including the "user hasn't seen it yet"
      check. `FirstRunTour` dynamic import gated off entirely in demo.
- [ ] **Command-Palette** — Cmd/Ctrl+K listener either ignored or **not
      registered** in demo (prefer: don't register the listener).
- [ ] **Settings-Sheet** — auto-open effects suppressed; the settings-gear button
      stays visually present but its handler is a no-op.
- [ ] **Auto-focus on composer/inputs at mount** — suppressed (must not steal the
      cursor inside the iframe).
- [ ] **Auto-scroll-to-bottom in conversation** — single initial scroll OK;
      continuous auto-scroll suppressed.
- [ ] **Toast notifications** — provider renders empty (demo = visually static).
- [ ] **Realtime subscriptions** (Supabase channels) — not subscribed. (Covered
      structurally by the demo supabase stub: `channel()/on()/subscribe()` are
      no-ops; still skip the subscribe call where cheap.)
- [ ] **Polling intervals** (`use*Poll`, model-health, usage, build-status) —
      cleared / not started.
- [ ] **Service-worker / push-notification permission prompts** — not triggered.
- [ ] **Analytics events** — none fired, including pageview.

### Stub-proxy unmount safety (answer to Checkpoint #1 follow-up)

The demo supabase stub's chainable proxy returns a **truthy callable for every
property access** — so any cleanup path is crash-safe:

- `auth.onAuthStateChange(cb)` returns `{ data: { subscription: { unsubscribe } } }`
  with a real no-op `unsubscribe`, so `return () => subscription.unsubscribe()`
  cleanups don't throw.
- `channel().on().subscribe()` returns a channel-like whose `unsubscribe()` is a
  no-op; `removeChannel(ch)` is a no-op.
- Any property the stub doesn't explicitly model resolves through the proxy to a
  callable returning the proxy (and the proxy is `await`-able → `{data:[],error:null}`),
  never `undefined` — so `undefined.unsubscribe()` cannot happen.
- **Fail-loud, not silent:** an *unmodelled* call path emits a one-time
  `console.warn("[demo-supabase] unmodelled call: <path>")` in dev so the gap
  surfaces next sprint, while still returning a safe value at runtime.

---

## Code-View scope (Checkpoint #1 follow-up decision, 2026-06-08)

The code view's data layer turned out to be **much deeper than the Checkpoint #1
estimate** ("CodeWorkspace ~30–40 LOC, one seed prop"). `CodeWorkspace` is not
prop-driven — it sits on a 3-hook layer:

- `useCodeSessions(projectId)` — session list + active session (Railway API)
- `SessionPane` → `useCodeSessionDetail(id)` → `{ files, messages, activePath,
  activeFile, deployUrl, persistFile, editActive, mergeDraft, deploy, … }`
- `useCodeAgent(id)` → `{ streaming, text, blocks, submit, cancel, … }`
- plus SessionPane machinery: thread, diff-review cards, deploy flow, auto-title.

Full-fidelity code (**Option α**) means replicating 3 hook return shapes (~40–60
fields incl. callbacks) + suppressing deploy/submit/review — ~100–180 LOC over
5–6 files, brittle (tsc-guarded). That is 3–4× the accepted estimate.

**DECISION — Option β (real chrome + real editor leaf).** The code demo renders:

```
DemoApp view="code"  →  DashboardShell (real Header + Sidebar + tab-bar, Code tab active)
                          └─ CodeEditor (real leaf) content=DEMO_CODE_FILES[0] readOnly
```

- The **chrome is 100% the real production shell**; the **editor is the real
  `CodeEditor` leaf** showing `Navbar.tsx`. ~95–99% of visible pixels match the
  real Code tab.
- **Not shown:** the multi-session SessionPane (session tabs, thread drawer,
  diff-review cards) — power-user surfaces a pitch viewer doesn't miss in a
  4-second glance, and the lowest-storytelling of the three views (§05's hero is
  Chat→Code side-by-side; §04 is the three-device proof).
- **Chat (mobile + desktop) and Preview stay full-fidelity** — unaffected by this.

**Option α is deferred to a later mini-sprint (Sprint 11)** — best done once the
real app gains Storybook (which would document the hook shapes as mock data) or
when an investor explicitly asks for the multi-session code workflow.

Consequence for `DemoApp`: the `code` branch renders `CodeEditor`, **not**
`CodeWorkspace`. No code-hook seeding. `demo-code-files.ts` seeds the editor leaf.
