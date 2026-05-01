# Goblin — Final Status Report

**Date:** 2026-05-01  
**Sprint:** 1A → 2C (8 Prompts)  
**Branch:** master

---

## Manual Testing Checklist — Island Flow

### Auth
- [ ] Login with Google OAuth — redirect to /dashboard
- [ ] Login with GitHub OAuth — redirect to /dashboard  
- [ ] Login with Apple OAuth — redirect to /dashboard
- [ ] Logout — session cleared, redirect to /login
- [ ] Session persists on page reload

### Project Management
- [ ] New project modal — name + description → created, redirected to project
- [ ] Project appears in sidebar + dashboard grid
- [ ] Project card click → opens workspace
- [ ] Sidebar collapses/expands on desktop
- [ ] Sidebar opens as bottom-sheet on mobile (iOS Safari)

### Chat + AI
- [ ] Chat opens, model picker dropdown shows available models
- [ ] BYOK key connected → model appears in picker (labelled "BYOK")
- [ ] Free-tier model (Gemini Flash) works without key
- [ ] AI responds with streaming text
- [ ] Code blocks render with syntax highlight + [Send to Code →] button
- [ ] Per-message token display (input / output counts)
- [ ] "Thinking" phrase rotates (not static "Goblin is thinking")
- [ ] Error state shows with Dismiss button
- [ ] FirstChatTip banner visible on first open, dismissable

### Send to Code Flow
- [ ] [Send to Code →] button on code block sends payload
- [ ] Code tab opens (or tab indicator lights up)
- [ ] Injection Banner shows: "✦ Injected via Send to Code — [filename]"
- [ ] [▶ Build] button visible in banner
- [ ] [→ Push GitHub] button visible in banner
- [ ] [×] clears banner

### Code Tab
- [ ] File tree loads (desktop: left sidebar)
- [ ] File tree mobile: select dropdown at top
- [ ] Click file → opens in CodeMirror editor
- [ ] Edit → auto-saves (1.5s debounce), save indicator visible
- [ ] Pending injections badge at bottom
- [ ] Build status bar appears during deploy
- [ ] Mobile FAB: ▶ and ⬆ buttons visible bottom-right

### GitHub Integration
- [ ] Settings → Integrations → Connect GitHub → OAuth redirect
- [ ] After connect: "GitHub connected" toast
- [ ] [→ Push GitHub] opens PushToGitHubModal
- [ ] Modal: repo name, description, private toggle
- [ ] Push → success URL shown, toast "Pushed to GitHub ✓"
- [ ] Push notification appears (if web push enabled)

### Vercel Deploy
- [ ] Vercel token added in Settings → API Keys
- [ ] [▶ Build] triggers SSE deploy stream
- [ ] Progress messages stream in real time
- [ ] Deploy message toast shows URL on success
- [ ] Push notification "✅ [project] deployed" appears

### Push Notifications
- [ ] Settings → General → Notifications → Enable
- [ ] Browser permission dialog appears
- [ ] "✓ Enabled" status shown after grant
- [ ] Send test → notification received
- [ ] Notification click opens correct URL
- [ ] Action button "Open Preview →" works

### Mobile (iPhone Safari)
- [ ] App loads, all fonts render
- [ ] Bottom tab bar visible [Chat] [Code] [Preview]
- [ ] Hamburger → sidebar opens as bottom sheet (slides up from bottom)
- [ ] Drag handle / tap to dismiss sidebar
- [ ] Chat input stays above keyboard
- [ ] Send to Code works on mobile
- [ ] Code tab file picker (select dropdown) works
- [ ] Mobile FAB visible and tappable (44px+ targets)
- [ ] PWA: "Add to Home Screen" works, standalone mode launches

### Settings
- [ ] BYOK: Add key → inline input, Save key, status "Connected ✓"
- [ ] BYOK: Connected key shows hint (sk-...ab3f) + date
- [ ] BYOK: Remove key → status reverts
- [ ] Fireworks AI + Custom endpoint in provider list
- [ ] Settings tabs: General / Developer
- [ ] Developer: Default model dropdown, timeout buttons, system prompt textarea
- [ ] Danger Zone: Delete account shows confirmation input

### Error States
- [ ] /not-found-page → 404 "This page ran away"
- [ ] /health → `{"status":"ok",...}`
- [ ] /health/deep → all checks shown
- [ ] Landing page loads at /
- [ ] /terms, /privacy, /imprint load

---

## What's Working ✅

### Frontend
- **Landing page** — Hero, Problem, Send-to-Code Demo, Island Flow, Pricing, FAQ, Footer
- **Auth** — Google + GitHub + Apple OAuth (Supabase), session management
- **Dashboard** — Project grid (2-col desktop, 1-col mobile), skeleton loaders, What's New
- **Sidebar** — Collapsible on desktop, bottom-sheet on mobile with drag handle
- **Header** — Logo, project name, tab switcher, mobile hamburger, token display
- **Bottom Tab Bar** — SVG icons, active indicator, injection badge on Code tab
- **Chat Tab** — Full streaming chat, CodeMirror-style code blocks, Send to Code, model picker per-chat, token display, rotating thinking phrases
- **Code Tab** — File tree (desktop), file picker dropdown (mobile), CodeMirror editor, auto-save, injection banner with Build + Push buttons, mobile FAB
- **Preview Tab** — Responsive switcher (375/768/Full), URL bar, iframe reload
- **BYOK Settings** — Card grid (2-col), provider cards with status, inline key input, Fireworks + Custom endpoint
- **Settings General/Developer** — Two-tab layout, profile, appearance, notifications, danger zone, default model, timeout, system prompt
- **Build Status Bar** — Animated progress, done/failed states, 30s fade
- **Push Notifications** — Subscribe/unsubscribe, test notification, service worker handlers
- **PWA** — manifest.json, offline.html, service worker cache strategy, Apple meta tags
- **Onboarding** — WelcomeModal (3-step), FirstChatTip banner (localStorage dismiss)

### Backend (API)
- **Auth middleware** — Supabase JWT validation on all protected routes
- **Chat** — Streaming SSE, model routing (BYOK → Free-API-Pool → Goblin Hosted), token counting
- **Projects** — CRUD, file storage read/write
- **GitHub** — OAuth flow, repo push, send-to-code injections
- **Deploy** — Vercel SSE deploy, status polling
- **BYOK Keys** — AES-256-GCM encrypt/decrypt, multi-provider
- **Build Runs** — start/status/project-list endpoints, internal PATCH
- **Notifications** — Subscribe, unsubscribe, send, test; web-push via VAPID
- **Billing** — Stripe checkout, subscription management, usage limits
- **Health** — `/health` basic, `/health/deep` (Supabase + Storage + LiteLLM)
- **Models** — Model list endpoint, model hub

### Infrastructure/Ops
- **Security headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy (next.config.ts)
- **Rate limiting** — Auth + chat endpoints
- **Startup migrations** — auto-creates `preview_url`, `build_runs` table if missing
- **.env.example** — fully annotated (web + api)
- **PRODUCTION_CHECKLIST.md** — pre-launch verification table
- **docs/DEPLOY.md** — step-by-step deploy guide

---

## Known Bugs / Edge Cases ⚠️

### High Priority
1. **WelcomeModal not triggered** — component exists but no logic yet to detect first-login state (no projects + no BYOK key). Need to add detection in DashboardLayout or DashboardPage.
2. **Build status polling** — `useBuildStatus` polls `/api/builds/project/:id` every 2s regardless of whether any build is running. Should pause when no active builds.
3. **build_runs table** — created by startup migration only if RPC `exec_sql` exists in Supabase. If not, builds route returns 500. Table must be created manually via Supabase SQL editor if migration fails.
4. **Code tab mobile overlay** — Mobile FAB uses `position: absolute` inside a div that may not be `position: relative` consistently across all layouts.

### Medium Priority
5. **Push GitHub button in injection banner** — wires to `PushToGitHubModal` but doesn't check if GitHub is connected first. Should show `ConnectGitHubModal` if not connected.
6. **FirstChatTip** — appears on every project open until dismissed, not just the first project. Ideally dismiss per-user in Supabase.
7. **Preview tab** — disabled in BottomTabBar regardless of whether `previewUrl` exists. Should enable dynamically.
8. **Model picker** — BYOK models only appear if key is fetched at chat-open. Stale state if user adds key mid-session.
9. **Dark mode CSS vars** — defined in `@media (prefers-color-scheme: dark)` but many components use hardcoded hex colors (`#2D4A2B`, `#EDE8DC`, etc.). Dark mode will be partial until components are audited.

### Low Priority
10. **SW version bump** — service worker GOBLIN_VERSION is hardcoded `'1.1.0'`. On new deploys, old caches won't invalidate until version is updated manually.
11. **Sidebar project links** — `app-shell/sidebar.tsx` navigates to `/project/:id` (missing `/dashboard` prefix). Should be `/dashboard/project/:id`.
12. **Settings Developer tab** — `setTimeout` variable shadows the global `window.setTimeout`. Rename to `timeoutSetting`.
13. **Legal pages** — use Tailwind className with no Tailwind config imported in `(legal)` route group layout. Pages need their own layout.tsx or inline styles.

---

## Phase 2 Features (Not Yet Built)

### Core Features
- [ ] **Real-time collaboration** — Supabase Realtime for shared project editing
- [ ] **Code editing** — CodeMirror write mode (currently read-only in Phase 1)
- [ ] **Terminal / shell** — Run commands in project sandbox
- [ ] **File upload** — Drag-and-drop files into project
- [ ] **Git branch management** — Create branches, PRs from within Goblin
- [ ] **Diff view** — Show changes before applying Send to Code

### AI/Model Features
- [ ] **Goblin Hosted GPU** — vLLM endpoint for self-hosted models (Phase 3 in arch)
- [ ] **Model fallback chain** — Drag-and-drop ordering in Developer settings (UI exists, logic missing)
- [ ] **Context window display** — Show % context used in current chat
- [ ] **Multi-file context** — Attach multiple files to a chat message
- [ ] **Memory / project context** — Persistent project context injected into every message

### Platform Features
- [ ] **Team accounts** — Invite teammates, shared projects
- [ ] **API access** — REST API for external integrations (grayed out in settings)
- [ ] **Webhooks** — Trigger builds via webhook (grayed out in settings)
- [ ] **Custom domain deploy** — Deploy to custom domains via Vercel/Cloudflare
- [ ] **Project templates** — Start from SaaS, landing page, API boilerplate
- [ ] **Export project** — Download as ZIP or push to new repo

### UX / Polish
- [ ] **Dark mode toggle** — CSS vars defined, UI toggle needs wiring
- [ ] **Keyboard shortcuts** — Cmd+K command palette, Cmd+Enter to send
- [ ] **Drag-to-dismiss sidebar** — Currently click-to-dismiss only; add touch swipe gesture
- [ ] **Long-press context menu** — Project rename/delete on mobile long-press
- [ ] **Pull-to-refresh** — Chat list refresh on mobile pull
- [ ] **Swipe to copy** — Swipe left on message to copy

### Monitoring / Analytics
- [ ] **Sentry integration** — Frontend + API error tracking
- [ ] **Usage analytics** — Mixpanel/PostHog for user behavior
- [ ] **Billing dashboard** — Current usage, plan upgrade flow
- [ ] **Admin panel** — User management, usage overview (`/api/admin` exists, UI missing)

---

## Next Steps for Phase 2

### Week 1 (Critical Bugs)
1. Fix WelcomeModal trigger logic (detect first-login in DashboardLayout)
2. Fix sidebar navigation URL (`/project/` → `/dashboard/project/`)
3. Fix Push GitHub button — check GitHub connection before opening modal
4. Create `build_runs` SQL migration script for manual Supabase setup
5. Fix legal pages layout (add `(legal)/layout.tsx`)

### Week 2 (Code Editor)
1. Enable CodeMirror write mode with diff highlighting
2. File create/delete/rename via API
3. Git diff view before applying Send to Code
4. Undo injection (revert last Send to Code)

### Week 3 (Collaboration)
1. Supabase Realtime subscription for project files
2. Presence indicators (who's viewing)
3. Comment threads on code blocks

### Week 4 (Platform)
1. Dark mode — audit and migrate hardcoded colors to CSS vars
2. Sentry integration (frontend + API)
3. Team invites (email-based)
4. Usage analytics setup

---

## Git Summary

| Commit | Description |
|--------|-------------|
| `6feecfd` | Landing, onboarding, brand voice, production readiness |
| `ab60f97` | PWA manifest, SW offline cache, mobile responsive, dark mode |
| `4c9ab02` | GitHub integration, build status system, Vercel deploy, push notifications |
| `b5be090` | Code tab injection banner, preview tab, BYOK card grid, settings tabs |
| `242178e` | Per-chat model picker, model hub, Send to Code flow, token display |
| `bfdc8ca` | New dashboard, collapsing sidebar, project detail, header redesign |
| `0376445` | Google/GitHub/Apple OAuth, new login page |

---

## Architecture Quick Reference

```
apps/
├── web/          Next.js 15 App Router, Tailwind, Supabase client
│   ├── app/
│   │   ├── (marketing)/     Landing page
│   │   ├── (legal)/         Terms, Privacy, Imprint
│   │   ├── dashboard/       Protected app shell
│   │   └── login/
│   ├── components/
│   │   ├── workspace/       ChatTab (main chat)
│   │   ├── project/         CodeTab, PreviewTab, GitHub modals
│   │   ├── app-shell/       DashboardShell, Sidebar, BottomTabBar
│   │   ├── layout/          Header, Sidebar (full version)
│   │   ├── landing/         Hero, Pricing, FAQ, etc.
│   │   ├── settings/        KeysList, AddKeyModal
│   │   ├── build/           BuildStatusBar
│   │   └── onboarding/      WelcomeModal, FirstChatTip
│   └── public/
│       ├── sw.js            Service worker (offline cache + push)
│       ├── manifest.json    PWA manifest
│       └── offline.html     Offline fallback
│
└── api/          Hono.js Node server
    └── src/
        ├── routes/   chat, projects, github, deploy, builds,
        │             notifications, byok-keys, billing, health
        ├── services/ github-oauth, github-service, vercel-service,
        │             notification-service, model-router, encryption
        └── middleware/ auth, rate-limit, usage-limit
```
