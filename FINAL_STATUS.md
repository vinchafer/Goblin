# Goblin — Final Status Report

**Date:** 2026-05-01  
**Sprint:** 1A → 3 (16 Prompts)  
**Branch:** master  
**Version:** 0.4.0

---

## Manual Testing Checklist — Island Flow

### Auth
- [x] Login with Google OAuth — redirect to /dashboard
- [x] Login with GitHub OAuth — redirect to /dashboard  
- [ ] Login with Apple OAuth — redirect to /dashboard (not tested)
- [x] Logout — session cleared, redirect to /login
- [x] Session persists on page reload

### Project Management
- [x] New project modal — name + description → created, redirected to project
- [x] Project appears in sidebar + dashboard grid
- [x] Project card click → opens workspace
- [x] Sidebar collapses/expands on desktop
- [x] Sidebar opens as bottom-sheet on mobile (iOS Safari)
- [x] New Project modal — Template gallery tab functional
- [x] From-template project creation

### Chat + AI
- [x] Chat opens, model picker dropdown shows available models
- [x] BYOK key connected → model appears in picker (labelled "BYOK")
- [x] Free-tier model (Gemini Flash) works without key
- [x] AI responds with streaming text
- [x] Code blocks render with syntax highlight + [Send to Code →] button
- [x] Per-message token display (input / output counts)
- [x] "Thinking" phrase rotates (not static "Goblin is thinking")
- [x] Error state shows with Dismiss button
- [x] FirstChatTip banner visible on first open, dismissable

### Send to Code Flow
- [x] [Send to Code →] button on code block sends payload
- [x] Code tab opens (or tab indicator lights up)
- [x] Injection Banner shows: "✦ Injected via Send to Code — [filename]"
- [x] [▶ Build] button visible in banner
- [x] [→ Push GitHub] button visible in banner
- [x] [×] clears banner

### Code Tab
- [x] File tree loads (desktop: left sidebar)
- [x] File tree mobile: select dropdown at top
- [x] Click file → opens in CodeMirror editor
- [x] Edit → auto-saves (1.5s debounce), save indicator visible
- [x] Pending injections badge at bottom
- [x] Build status bar appears during deploy
- [x] Mobile FAB: ▶ and ⬆ buttons visible bottom-right

### GitHub Integration
- [x] Settings → Integrations → Connect GitHub → OAuth redirect
- [x] After connect: "GitHub connected" toast
- [x] [→ Push GitHub] opens PushToGitHubModal
- [x] Modal: repo name, description, private toggle
- [x] Push → success URL shown, toast "Pushed to GitHub ✓"
- [ ] Push notification on deploy (requires browser permission grant)

### Vercel Deploy
- [x] Vercel token added in Settings → API Keys
- [x] [▶ Build] triggers SSE deploy stream
- [x] Progress messages stream in real time
- [x] Deploy message toast shows URL on success
- [ ] Push notification "✅ [project] deployed" (requires browser permission)

### Push Notifications
- [x] Settings → General → Notifications → Enable
- [x] Browser permission dialog appears
- [x] "✓ Enabled" status shown after grant
- [x] Send test → notification received
- [ ] Notification click opens correct URL (browser-dependent)

### Mobile (iPhone Safari)
- [x] App loads, all fonts render
- [x] Bottom tab bar visible [Chat] [Code] [Preview]
- [x] Hamburger → sidebar opens as bottom sheet (slides up from bottom)
- [x] Drag handle / tap to dismiss sidebar
- [x] Chat input stays above keyboard
- [x] Send to Code works on mobile
- [x] Code tab file picker (select dropdown) works
- [x] Mobile FAB visible and tappable (44px+ targets)
- [ ] PWA: "Add to Home Screen" (requires HTTPS)

### Settings
- [x] BYOK: Add key → inline input, Save key, status "Connected ✓"
- [x] BYOK: Connected key shows hint (sk-...ab3f) + date
- [x] BYOK: Remove key → status reverts
- [x] Fireworks AI + Custom endpoint in provider list
- [x] Settings tabs: General / Developer
- [x] Dark mode toggle: Light / Dark / System — functional
- [x] Developer: Default model dropdown, timeout buttons, system prompt textarea
- [x] Danger Zone: Delete account shows confirmation input

### Admin Panel (/admin)
- [x] Redirects to /dashboard if is_admin = false
- [x] Users table with search + pagination
- [x] Plan/suspend actions via modal
- [x] Models toggle available on/off
- [x] Builds list with status filters + cancel button
- [x] Incident CRUD for public /status page

### Billing Dashboard (/dashboard/billing)
- [x] Current plan card + upgrade buttons
- [x] Usage bar with breakdown by tier
- [x] Invoice history (from Stripe)
- [x] Payment method display
- [x] Portal redirect via Stripe Customer Portal

### Error States
- [x] /not-found-page → 404 "This page ran away"
- [x] /health → `{"status":"ok",...}`
- [x] /health/deep → all checks shown
- [x] Landing page loads at /
- [x] /terms, /privacy, /imprint load
- [x] /status loads with service checks
- [x] /badge loads with embed codes

---

## What's Working ✅

### Frontend (Sprint 3 additions)
- **Dark mode** — ThemeProvider, CSS custom properties, no-flash init script
- **Command Palette** — Cmd+K, fuzzy search, 20+ commands, category grouping
- **Keyboard shortcuts** — Cmd+1/2/3/B/N/S/K, `?` help modal
- **Admin Panel** — Users/Models/Builds/Status (secured via server-side proxy)
- **Billing Dashboard** — Plan, usage, invoices, payment method
- **Template Gallery** — 10 official templates, gallery UI, from-template creation
- **Built with Goblin badge** — 3 SVG variants + `/badge` page
- **PostHog analytics** — DoNotTrack-aware, 8 business events
- **Sidebar billing link** — Desktop + mobile navigation

### Backend (Sprint 3 additions)
- **Templates API** — GET list/slug, POST from-template with file copy
- **Billing API** — /invoices, /payment-method, /usage endpoints
- **Admin API** — Full CRUD: users, models, builds, incidents, stats
- **DB migrations** — is_admin, is_suspended columns, incidents table, 12 perf indexes
- **Templates seed** — 10 official starter templates with real code

### Tests (Sprint 3 additions)
- **Unit tests** — 33 Vitest tests (encryption: 11, pricing: 13, pricing-calc: 9) — all green
- **E2E tests** — Playwright suite: auth, landing, static pages, mobile
- **GitHub Actions CI** — E2E + build pipeline

---

## Known Bugs / Edge Cases ⚠️

### Still Open
2. **Build status polling** — `useBuildStatus` polls every 2s regardless. Should pause when no active builds.
3. **build_runs table** — startup migration requires `exec_sql` RPC in Supabase. Create manually if it fails.
5. **Push GitHub button** — doesn't check if GitHub is connected first.
6. **FirstChatTip** — appears on every project open until dismissed (not per-user in DB).
7. **Preview tab** — disabled in BottomTabBar regardless of whether `previewUrl` exists.
8. **Model picker** — stale state if user adds BYOK key mid-session.

### Fixed in Sprint 3
- ✅ #1 WelcomeModal not triggered — isFirstLogin logic added to DashboardLayout
- ✅ #4 Mobile FAB position — layout z-index / position fixed
- ✅ #9 Dark mode partial — full CSS variable system implemented
- ✅ #11 Sidebar project links — correct `/dashboard/project/:id` paths
- ✅ Admin API key exposed — now server-side only via Next.js route handler proxy

---

## Phase 2 / Backlog

### Core Features (not yet built)
- [ ] Terminal / shell — run commands in sandbox
- [ ] File upload — drag-and-drop into project
- [ ] Git branch management — branches, PRs within Goblin
- [ ] Multi-file context — attach files to chat messages
- [ ] Memory / project context — persistent context injected into chats

### AI / Model
- [ ] Goblin Hosted GPU — vLLM endpoint for self-hosted models
- [ ] Context window display — % context used in current chat

### Platform
- [ ] Team accounts — invite teammates, shared projects
- [ ] API access + Webhooks — programmatic integrations
- [ ] Custom domain deploy

### UX / Polish
- [ ] Drag-to-dismiss sidebar — touch swipe gesture
- [ ] Long-press context menu — project rename/delete on mobile
- [ ] Pull-to-refresh — chat list on mobile
