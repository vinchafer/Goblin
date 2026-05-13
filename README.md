# Goblin 👺

**Build from anywhere. No laptop required.**

Goblin is a cloud IDE for makers — chat with AI to build full-stack apps, push to GitHub, and deploy to Vercel, all from your phone or any browser. You bring your own API keys (BYOK) to access any AI model with zero markup.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), Tailwind CSS v4, TypeScript |
| Backend | Hono (Node.js), Supabase (Postgres + Auth + Storage) |
| AI | LiteLLM proxy, BYOK (Anthropic/OpenAI/Gemini/Groq/+8 more), Free-API pool |
| Payments | Stripe (subscriptions, usage-based limits) |
| Deploy | Vercel (via API), GitHub (OAuth + repo push) |
| Monitoring | Sentry, PostHog, structured logging (pino) |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/yourusername/goblin.git && cd goblin

# 2. Install
pnpm install

# 3. Environment
cp .env.example .env
# Fill in NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# ENCRYPTION_KEY (32 chars), STRIPE_* keys, LITELLM_BASE_URL

# 4. Supabase setup
# Run supabase/migrations/*.sql in order via Supabase SQL editor

# 5. Dev
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:3001
```

## Architecture

```
apps/
  web/          # Next.js frontend
    app/        # App Router pages
    components/ # UI components
    lib/        # Supabase, analytics, theme
  api/          # Hono REST API
    src/
      routes/   # chat, projects, billing, admin, templates
      services/ # encryption, file-storage, billing, model-router
      middleware/ # auth, usage-limit, rate-limit
packages/
  shared/       # Zod schemas shared between web + api
supabase/
  migrations/   # SQL migrations (0001 → 0021)
  seeds/        # Template marketplace seed data
```

## Authentication

Goblin supports two sign-in methods:

| Method | Flow | Default |
|--------|------|---------|
| **Magic Link** | Enter email → get a link → click to sign in | ✅ Default |
| **Password** | Enter email + password → sign in immediately | Toggle on login page |

Both methods coexist on the `/login` page via a toggle. Password sign-up includes strength indicator and Terms acceptance. Forgot password → `/auth/reset-password`.

OAuth via Google, GitHub, or Apple is also supported.

## Features

- **Chat-to-code** — describe what to build, AI generates files
- **Send to Code** — extract code blocks from chat directly into editor
- **CodeMirror editor** — syntax highlighting, auto-save, diff view
- **BYOK** — connect any AI provider, no markup, encrypted at rest (AES-256-GCM)
- **Template marketplace** — 10 official starters (SaaS, Landing, API, Blog…)
- **GitHub integration** — push to new/existing repos
- **Vercel deploy** — one-click deploy with live progress stream
- **Dark mode** — system-aware, persisted preference
- **Cmd+K command palette** — quick navigation and actions
- **PWA** — installable on iOS/Android, offline shell
- **Admin panel** — user management, model toggles, incident management

## Contributing

Join the Discord → [discord.gg/goblin](https://discord.gg/goblin)
