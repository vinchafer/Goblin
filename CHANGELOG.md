# Changelog

All notable changes to Goblin are documented here.

---

## [0.4.0] — 2026-05-01 — Sprint 3: Polish, Admin, Tests

### Added
- **Dark mode** — full system with `ThemeProvider`, `[data-theme="dark"]` CSS vars, no-flash inline script, Settings toggle
- **Cmd+K command palette** — vanilla fuzzy search, category grouping, keyboard nav, 20+ commands
- **Global keyboard shortcuts** — Cmd+1/2/3 tabs, Cmd+B sidebar, Cmd+K palette, `?` shortcut help modal
- **Micro-animations** — `modalIn`, `overlayIn`, `cardStagger`, `messageSlide` keyframes; `prefers-reduced-motion` support
- **Admin panel** (`/admin`) — Users table with search/pagination, Models CRUD with availability toggle, Builds monitor with cancel, Incident management
- **Admin security proxy** — `/api/admin/[...path]` route handler injects `ADMIN_API_KEY` server-side; `is_admin` guard via Supabase
- **User billing dashboard** (`/dashboard/billing`) — plan display, usage breakdown by tier, invoice history (Stripe), payment method
- **PostHog analytics** — `initAnalytics()`, 8 tracked events, DoNotTrack-aware, dynamic import
- **Template marketplace** — 10 official starters, template gallery UI with category filters, hover preview, from-template project creation
- **Built with Goblin badge** — 3 SVG variants (standard/dark/minimal), embed codes at `/badge`
- **Performance indexes** — 12 new DB indexes on FKs and hot columns
- **CodeMirror lazy load** — dynamic import reduces initial bundle
- **E2E tests** — Playwright suite (auth, landing, static pages, mobile)
- **Unit tests** — Vitest suite (encryption roundtrip, pricing calculations)
- **GitHub Actions CI** — E2E + build on PR/push to main
- **Startup migrations** — `is_admin`, `is_suspended` columns, `incidents` table auto-created
- **Billing API** — `/invoices`, `/payment-method`, `/usage` endpoints (Stripe integration)
- **Public `/status` page** — shows incidents from DB, active incident banner

### Fixed
- Admin API key never exposed to browser (was `NEXT_PUBLIC_ADMIN_KEY`, now server-side proxy)
- Google Fonts preconnect in layout head
- Sidebar billing navigation link

---

## [0.3.0] — 2026-04-15 — Sprint 2: Mobile, PWA, Landing

### Added
- **Mobile-first UI** — Bottom tab bar, bottom-sheet sidebar, FAB buttons, 44px touch targets
- **PWA** — `manifest.json`, service worker with cache strategy, offline shell, Apple meta tags
- **Landing page** — Hero, Problem section, Send-to-Code demo, Island Flow explainer, Pricing (3 tiers), FAQ, Footer
- **Supabase Realtime** — live build status updates
- **Sentry integration** — error tracking for API + web
- **Health monitoring** — `/health` basic + `/health/deep` with service checks
- **Structured logging** — pino logger with request timing

---

## [0.2.0] — 2026-03-15 — Sprint 1: Core Product

### Added
- **Chat** — streaming SSE, model routing (BYOK → Free-API → Goblin Hosted), token counting, code block rendering
- **Send to Code** — extracts code from chat, injects into editor with banner + Build/Push buttons
- **CodeMirror editor** — syntax highlighting (JS/TS/CSS/HTML/JSON), auto-save (1.5s debounce), diff view, undo injection
- **File tree** — desktop sidebar, mobile select dropdown
- **GitHub integration** — OAuth flow, push to new/existing repo, `PushToGitHubModal`
- **Vercel deploy** — SSE deploy stream, progress messages, URL on success
- **BYOK** — AES-256-GCM encrypt/decrypt, 10 providers (Anthropic/OpenAI/Gemini/Groq/Mistral/DeepSeek/xAI/Together/Fireworks/OpenRouter), custom endpoint support
- **Model hub** — provider-driven model list, fallback chain logic, accurate token pricing
- **Billing** — Stripe checkout, subscription management, webhook handlers, usage limits (atomic increment)
- **Push notifications** — VAPID web push, subscribe/unsubscribe, test notification
- **Onboarding** — WelcomeModal (3-step), FirstChatTip banner

---

## [0.1.0] — 2026-02-15 — Sprint 0: Foundation

### Added
- **Auth** — Supabase OAuth (Google, GitHub, Apple), session middleware
- **Project CRUD** — create, list, open workspace
- **Dashboard** — project grid, skeleton loaders, What's New section
- **Sidebar** — collapsible desktop, bottom-sheet mobile
- **Header** — logo, tab switcher, project name, mobile hamburger
- **Settings** — General (profile, appearance, notifications, danger zone), Developer (default model, timeout, system prompt)
- **Security headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy
- **Rate limiting** — auth + chat endpoints
- **PRODUCTION_CHECKLIST.md** — pre-launch verification
- **DB migrations** — initial schema, storage RLS, GitHub OAuth states, analytics views
