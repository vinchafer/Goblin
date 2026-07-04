import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co';

const API_URL = process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://goblinapi-production.up.railway.app' : 'http://localhost:3001');

// Content-Security-Policy
// Note: unsafe-inline required for Next.js inline styles; unsafe-eval required in dev.
// In production builds, Next.js inlines a small script chunk — nonce-based CSP
// would require a custom server; we accept unsafe-inline for now.
// Stripe Elements/SetupIntent checkout (CheckoutPanel) loads js.stripe.com,
// talks to api.stripe.com, and renders the card field inside js.stripe.com /
// hooks.stripe.com iframes. Without these the publishable key is inlined fine
// but Stripe.js is CSP-blocked → useStripe() stays null → the subscribe button
// is permanently disabled and <PaymentElement> never mounts.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: https:`,
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} ${API_URL} https://api.anthropic.com https://openrouter.ai https://api.stripe.com`,
  `frame-src https://js.stripe.com https://hooks.stripe.com`,
  `media-src 'self' blob:`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

// Demo routes (/demo-*) are embedded as iframes by the pitch at justgoblin.dev
// (Sprint 7 §C). Relax ONLY the frame policy for them — drop X-Frame-Options:DENY
// and widen CSP frame-ancestors. Every other security header stays identical, and
// every non-demo route keeps the locked-down set below (note the negative-lookahead
// source so the two header rules never both match and emit a duplicate CSP).
const demoCsp = csp.replace(
  "frame-ancestors 'none'",
  "frame-ancestors 'self' https://justgoblin.dev",
);
const demoSecurityHeaders = securityHeaders
  .filter((h) => h.key !== 'X-Frame-Options')
  .map((h) =>
    h.key === 'Content-Security-Policy' ? { ...h, value: demoCsp } : h,
  );

const nextConfig: NextConfig = {
  transpilePackages: ['@goblin/shared'],
  distDir: process.env.GOBLIN_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(),
  },
  async headers() {
    return [
      {
        source: '/demo-:slug',
        headers: demoSecurityHeaders,
      },
      {
        source: '/((?!demo-).*)',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // LP-3: legacy /landing-v2 review URL → production / (LP-2 is now the landing)
      { source: '/landing-v2', destination: '/', permanent: true },
      // H3: /de previously 404'd (no route, no i18n routing). The marketing landing
      // is served language-neutral at / (client toggles DE/EN), so /de has no distinct
      // canonical page — 301 it to the canonical landing. Runs before auth middleware,
      // so unauthenticated visitors are not bounced to /login. /en and / are untouched.
      { source: '/de', destination: '/', permanent: true },
    ];
  },
};

// Wrap with Sentry only when auth token is present (production builds with source-map upload).
// Without the token, source-map upload is skipped and CI stays green.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG || 'goblin',
      project: process.env.SENTRY_PROJECT || 'goblin-web',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      sourcemaps: { disable: false },
      disableLogger: true,
    })
  : nextConfig;
