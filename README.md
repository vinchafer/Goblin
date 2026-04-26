# Goblin

The Cloud Workshop for Builders

## Stack

- **Monorepo**: pnpm Workspaces
- **Frontend**: Next.js 15 + React 19 + Tailwind 4
- **Backend**: Hono
- **Shared**: TypeScript + Zod
- **Strict mode everywhere**

## Setup

```bash
# Install dependencies
pnpm install

# Validate environment variables
npx tsx scripts/validate-env.ts

# Start development servers
pnpm dev

# Build all packages
pnpm build

# Run type checking across all workspaces
pnpm typecheck

# Run lint across all workspaces
pnpm lint

# Run smoke test (requires running API server)
npx tsx scripts/smoke-test.ts
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web | 3000 | Next.js Application |
| API | 3001 | Hono Backend Server |

## Workspaces

- `apps/web` - Next.js frontend application
- `apps/api` - Hono backend API
- `packages/shared` - Shared types, schemas and utilities

## 🔑 BYOK Setup

1. Go to `/dashboard/settings/keys`
2. Add your Anthropic or OpenAI API key
3. Your keys are encrypted at rest and never leave your account

## 🐙 GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Create new OAuth App:
   - Name: Goblin (dev)
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/dashboard/settings/integrations/github-callback`
3. Copy Client ID + Client Secret to your `.env`

## 📤 Push to GitHub

1. Connect your GitHub account from `/dashboard/settings/integrations`
2. Generate a project
3. Click "Push to GitHub"
4. Your project will be created as a new repository

## 💳 Stripe Setup

1. Create a Stripe account (test mode)
2. Create 3 products: Goblin Seed, Goblin Craft, Goblin Forge
3. Add monthly recurring price to each product
4. Copy price IDs to your `.env`
5. Install Stripe CLI for local webhooks:
   ```bash
   stripe listen --forward-to localhost:3001/api/billing/webhook
   ```
6. Copy webhook signing secret to your `.env`

## 📊 Plans

| Plan   | Price | Monthly Requests |
|--------|-------|------------------|
| Seed   | $9    | 200              |
| Craft  | $19   | 800              |
| Forge  | $39   | 3000             |

All plans include unlimited projects and GitHub push integration.

## 🚀 Deployment

### Vercel (Frontend)

The `vercel.json` at the repo root configures the Next.js frontend deployment.
API routes are proxied to the standalone API server.

### Railway / Docker (API)

The API server runs as a standalone Node.js process. See `apps/api/Dockerfile`
and `apps/api/railway.json` for deployment configuration.

### Environment Variables

Copy `.env.example` to `.env` and fill in all required values. Run the
validation script to check your setup:

```bash
npx tsx scripts/validate-env.ts
```

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `scripts/validate-env.ts` | Validates all required environment variables |
| `scripts/smoke-test.ts` | End-to-end test: user → project → chat → cleanup |
