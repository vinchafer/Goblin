# Goblin Deployment Guide

Step-by-step from repo to live URL.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) account
- A [Vercel](https://vercel.com) account (for the web app)
- A [Hetzner](https://www.hetzner.com/storage/object-storage) or S3-compatible storage account
- A [Stripe](https://stripe.com) account (for billing)

---

## 1. Clone & Install

```bash
git clone https://github.com/your-org/goblin.git
cd goblin
npm install
```

---

## 2. Supabase Setup

### 2.1 Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose **Frankfurt (eu-central-1)** region for GDPR compliance
3. Note your **Project URL** and **Service Role Key**

### 2.2 Run Migrations
Connect to your Supabase project and run the SQL files in order:

```bash
# Or use Supabase CLI:
supabase db push
```

Key tables created by startup migrations (auto-run on API start):
- `projects` — user projects
- `agent_runs` — chat history
- `byok_keys` — encrypted API keys
- `push_subscriptions` — web push subscriptions
- `oauth_states` — GitHub OAuth CSRF tokens
- `build_runs` — deploy/build tracking

### 2.3 Enable RLS
In Supabase dashboard → Authentication → Policies, verify RLS is enabled on all tables.

### 2.4 Configure Auth Providers
Go to Authentication → Providers:
- **Google**: Enable, add Client ID + Secret from [Google Console](https://console.cloud.google.com)
- **GitHub**: Enable, add Client ID + Secret from [GitHub Developer Settings](https://github.com/settings/developers)

Redirect URL: `https://your-project.supabase.co/auth/v1/callback`

---

## 3. Environment Variables

### 3.1 Web App (apps/web)
Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

### 3.2 API Server (apps/api)
Copy `apps/api/.env.example` to `apps/api/.env` and fill in all required fields.

**Generate VAPID keys:**
```bash
npx web-push generate-vapid-keys
```

**Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Hetzner Object Storage

1. Go to [Hetzner Console](https://console.hetzner.com) → Object Storage → Create Bucket
2. Region: **Falkenstein (fsn1)**
3. Name: `goblin-projects`
4. Access Control: Private
5. Create Access Keys → save as `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY`
6. Set `STORAGE_ENDPOINT=https://goblin-projects.fsn1.your-objectstorage.com`

---

## 5. GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New
2. **Homepage URL**: `https://yourdomain.com`
3. **Callback URL**: `https://api.yourdomain.com/api/github/callback`
4. Save Client ID + Secret → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
5. Set `GITHUB_REDIRECT_URI=https://api.yourdomain.com/api/github/callback`

---

## 6. Stripe Setup

1. Create account at [stripe.com](https://stripe.com)
2. Create 3 products: **Seed** ($9), **Craft** ($19), **Forge** ($39)
3. Copy Price IDs → `STRIPE_PRICE_SEED`, `STRIPE_PRICE_CRAFT`, `STRIPE_PRICE_FORGE`
4. Add webhook endpoint: `https://api.yourdomain.com/api/billing/webhook`
5. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
6. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

---

## 7. Deploy the API (Hetzner / Fly.io / Railway)

### Option A: Hetzner VPS
```bash
# On server:
git clone https://github.com/your-org/goblin.git
cd goblin/apps/api
npm install
cp .env.example .env  # fill in values
npm run build
npm start
# Use PM2 or systemd to keep alive
pm2 start dist/index.js --name goblin-api
```

### Option B: Railway
1. New project → from GitHub repo
2. Select `apps/api` as root directory
3. Add all env vars from `.env.example`
4. Railway auto-deploys on push

### Option C: Fly.io
```bash
cd apps/api
fly launch
fly secrets set ENCRYPTION_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

---

## 8. Deploy the Web App (Vercel)

### 8.1 Connect Repository
1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import from GitHub → select your repo
3. **Root Directory**: `apps/web`
4. **Framework**: Next.js (auto-detected)

### 8.2 Environment Variables
In Vercel project settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL        → https://api.yourdomain.com
NEXT_PUBLIC_APP_URL        → https://yourdomain.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

### 8.3 Deploy
Click **Deploy** or push to `main` — Vercel auto-deploys.

---

## 9. Domain Configuration (Cloudflare + Vercel)

### 9.1 Vercel Domain
1. Vercel project → Settings → Domains → Add `yourdomain.com` and `www.yourdomain.com`
2. Copy the CNAME/A records shown

### 9.2 Cloudflare Setup
1. Add your domain to Cloudflare (free plan works)
2. Set nameservers to Cloudflare's
3. DNS Records:
   - `yourdomain.com` → Vercel IP (A record, proxied)
   - `www.yourdomain.com` → Vercel CNAME (proxied)
   - `api.yourdomain.com` → your API server IP (proxied)
4. SSL/TLS → Full (Strict)
5. Always Use HTTPS: On

### 9.3 Update OAuth Callbacks
After domain is live, update:
- Supabase Auth redirect URLs
- GitHub OAuth callback URL
- Stripe webhook URL

---

## 10. Post-Deploy Verification

```bash
# Health check
curl https://api.yourdomain.com/health
# Expected: {"status":"ok","timestamp":"...","version":"..."}

# Deep health check
curl https://api.yourdomain.com/health/deep
# Expected: {"status":"ok","checks":{"supabase":"ok","storage":"ok",...}}

# Test push notifications
# Open https://yourdomain.com/dashboard/settings → enable notifications → send test
```

---

## 11. Monitoring

- **Uptime**: Set up [BetterUptime](https://betteruptime.com) or [UptimeRobot](https://uptimerobot.com) on `/health`
- **Errors**: Add Sentry DSN to both apps (see `SENTRY_DSN` in `.env.example`)
- **Logs**: Vercel has built-in log streaming; for API use PM2 logs or Fly.io log drain

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API returns 401 | Check `SUPABASE_SERVICE_ROLE_KEY` is set |
| GitHub OAuth fails | Verify callback URL matches exactly |
| Push notifications not working | Check VAPID keys match in web + API |
| Storage 403 errors | Check `STORAGE_ACCESS_KEY` permissions |
| Stripe webhooks fail | Verify `STRIPE_WEBHOOK_SECRET` and endpoint URL |
