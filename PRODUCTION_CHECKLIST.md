# Goblin Production Checklist

Last updated: 2026-05-01

## Security

| Item | Status | Notes |
|------|--------|-------|
| No secrets in git history | ⚠️ Verify | Run `git log --all --full-history -- '*.env'` |
| HTTPS enforced | ⚠️ Pending | Configure via Cloudflare (Full Strict mode) |
| CSP Headers | ✅ Done | Configured in `apps/web/next.config.ts` |
| X-Frame-Options: DENY | ✅ Done | `next.config.ts` |
| HSTS header | ✅ Done | `next.config.ts` |
| Rate limiting on auth endpoints | ✅ Done | `apps/api/src/middleware/rate-limit.ts` |
| Rate limiting on chat endpoints | ✅ Done | Usage limits middleware |
| CORS restricted to production domains | ✅ Done | `apps/api/src/index.ts` |
| BYOK keys encrypted at rest (AES-256-GCM) | ✅ Done | `apps/api/src/services/encryption.ts` |
| GitHub OAuth state validation | ✅ Done | One-time use, expiry enforced |
| Supabase RLS policies enabled | ⚠️ Verify | Check each table in Supabase dashboard |
| Webhook secrets validated | ✅ Done | Stripe `whsec_` validation |
| SQL injection: Supabase parameterized queries | ✅ Done | All queries use Supabase client |
| XSS: dangerouslySetInnerHTML usage reviewed | ⚠️ Verify | `chat-tab.tsx` uses sanitized HTML |

## Performance

| Item | Status | Notes |
|------|--------|-------|
| Bundle size < 300KB initial JS | ⚠️ Measure | Run `next build && npx @next/bundle-analyzer` |
| CodeMirror lazy-loaded | ✅ Done | `dynamic(() => import(...), { ssr: false })` |
| PreviewTab lazy-loaded | ✅ Done | `project-workspace.tsx` |
| Google Fonts with `display: swap` | ✅ Done | `layout.tsx` |
| Images: next/image for static assets | ⚠️ Pending | Audit image tags |
| Service Worker caching active | ✅ Done | `apps/web/public/sw.js` |

## PWA / Mobile

| Item | Status | Notes |
|------|--------|-------|
| manifest.json complete | ✅ Done | Shortcuts, maskable icon, categories |
| Apple meta tags | ✅ Done | `layout.tsx` |
| Offline fallback page | ✅ Done | `/public/offline.html` |
| Service Worker offline cache | ✅ Done | Cache-first for static, network-first for navigation |
| Touch targets ≥ 44px | ✅ Done | `globals.css` mobile enforcement |
| Bottom tab bar on mobile | ✅ Done | `BottomTabBar` component |
| Mobile sidebar as bottom sheet | ✅ Done | `layout/Sidebar.tsx` |

## Monitoring

| Item | Status | Notes |
|------|--------|-------|
| Health check: GET /health | ✅ Done | Returns `{ status, timestamp, version }` |
| Deep health check: GET /health/deep | ✅ Done | Checks Supabase, Storage, LiteLLM |
| Error page (500) | ✅ Done | `app/error.tsx` |
| 404 page | ✅ Done | `app/not-found.tsx` |
| Sentry frontend | ⚠️ Pending | Install `@sentry/nextjs`, add `sentry.client.config.ts` |
| Sentry backend | ⚠️ Pending | Install `@sentry/node`, wrap `apps/api/src/index.ts` |
| Uptime monitoring | ⚠️ Pending | BetterUptime or UptimeRobot on `/health` |

## Legal

| Item | Status | Notes |
|------|--------|-------|
| Terms of Service | ✅ Done | `/terms` |
| Privacy Policy | ✅ Done | `/privacy` |
| Imprint | ✅ Done | `/imprint` (Swiss law requirement) |
| Cookie banner | ⚠️ Pending | Only auth cookie used, minimal consent needed |
| GDPR mechanisms | ⚠️ Verify | Storage in EU (Backblaze B2, eu-central-003); Goblin-bundled inference in US under SCCs, zero-retention OSS models. State mechanisms, not "fully compliant". |

## Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| Supabase project in EU region | ✅ Confirm | Must be Frankfurt (eu-central-1) |
| Storage bucket created | ✅ Live | Backblaze B2 `goblin-projects`, eu-central-003 (EU) |
| GitHub OAuth App configured | ⚠️ Pending | Callback URL set to production API |
| Stripe webhooks configured | ⚠️ Pending | Point to production API `/api/billing/webhook` |
| VAPID keys generated | ⚠️ Pending | `npx web-push generate-vapid-keys` |
| Custom domain + Cloudflare | ⚠️ Pending | justgoblin.com, api.justgoblin.com |
| Vercel project linked to GitHub | ⚠️ Pending | Auto-deploy from main branch |

## Pre-Launch

| Item | Status | Notes |
|------|--------|-------|
| Run `next build` with no errors | ⚠️ Pending | |
| Run TypeScript check (`tsc --noEmit`) | ✅ Done | Passing |
| Test login flow (Google + GitHub) | ⚠️ Pending | |
| Test BYOK key add + chat | ⚠️ Pending | |
| Test GitHub push | ⚠️ Pending | |
| Test Vercel deploy | ⚠️ Pending | |
| Test PWA install on iOS Safari | ⚠️ Pending | |
| Test offline mode | ⚠️ Pending | |
| Lighthouse mobile score > 85 | ⚠️ Pending | |

## Status Legend
- ✅ Done
- ⚠️ Pending / Verify
- ❌ Blocked
