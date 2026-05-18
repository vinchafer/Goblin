import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: join(__dirname, '../../../.env') });

// Startup validation — fail fast with clear error messages
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
  'STRIPE_PRICE_BUILD_TIER1',
  'STRIPE_PRICE_PRO_TIER1',
  'STRIPE_PRICE_POWER_TIER1',
]

// Deprecated: Free-API Pool env vars (removed Strategy V1 C-8 — no more reselling)
// Remove GROQ_FREE_API_KEY, GOOGLE_FREE_API_KEY, CEREBRAS_FREE_API_KEY, OPENROUTER_FREE_API_KEY from Railway
// Users must connect their own API keys (BYOK) — see Settings → API Keys for free-tier recommendations

// Optional env vars for Goblin Hosted GPU (Phase 3)
// GOBLIN_GPU_ENDPOINT=          # vLLM-compatible endpoint URL
// GOBLIN_GPU_API_KEY=           # API key for GPU endpoint

const missing = REQUIRED_ENV.filter(key => !process.env[key])
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '))
  console.error('Copy .env.example to .env and fill in the values.')
  process.exit(1)
}

console.log('✅ Environment validation passed')

if (!process.env.ADMIN_API_KEY) {
  console.warn('⚠️  ADMIN_API_KEY not set — admin routes are disabled (all requests will return 401)')
}

// Run startup migrations (idempotent, safe to run multiple times)
try {
  const { runStartupMigrations } = await import('./startup-migrations.js')
  await runStartupMigrations()
} catch (error) {
  console.warn('Could not run startup migrations:', error)
}

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { initSentry, captureError } from './lib/sentry';
import logger, { logRequest } from './lib/logger';

initSentry();
import { generalRateLimit } from './middleware/rate-limit';
import { trialGate } from './middleware/trial-gate';
import { chat } from './routes/chat';
import { billing } from './routes/billing';
import { projects } from './routes/projects';
import { github } from './routes/github';
import { byokKeys as byok } from './routes/byok-keys';
import { health } from './routes/health';
import { sendToCode } from './routes/send-to-code';
import { notifications } from './routes/notifications';
import { models } from './routes/models';
import { admin } from './routes/admin';
import { deploy } from './routes/deploy';
import { builds } from './routes/builds';
import { users } from './routes/users';
import { templates } from './routes/templates';
import { chatSessions } from './routes/chat-sessions';
import { onboarding } from './routes/onboarding';
import { onboardingAgent } from './routes/onboarding-agent';
import { support } from './routes/support';
import { secrets } from './routes/secrets';
import { rankings } from './routes/rankings';
import { adminRankings } from './routes/admin-rankings';
import { startCron } from './lib/cron';

const app = new Hono();

// Build CORS origin list once at startup — avoids rebuilding on every request
const CORS_EXACT = new Set([
  'http://localhost:3000',
  'https://justgoblin.com',
  'https://www.justgoblin.com',
  process.env.NEXT_PUBLIC_APP_URL,
  // Additional origins from env var: ALLOWED_ORIGINS=https://a.com,https://b.com
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? []),
].filter(Boolean) as string[]);

// Wildcard patterns: only allow Goblin's own Vercel deployments, not arbitrary *.vercel.app.
// An attacker could deploy evilclone.vercel.app and use it as a CORS bypass.
const GOBLIN_VERCEL_PROJECT = process.env.VERCEL_PROJECT_ID || 'goblin-web';
const CORS_PATTERNS: RegExp[] = [
  // Only match preview deployments for the known project (e.g. goblin-web-*.vercel.app)
  new RegExp(`^https:\\/\\/${GOBLIN_VERCEL_PROJECT}[^./]*\\.vercel\\.app$`),
];

function isAllowedOrigin(origin: string): boolean {
  if (CORS_EXACT.has(origin)) return true;
  return CORS_PATTERNS.some(re => re.test(origin));
}

// Explicit OPTIONS preflight handler — runs before cors middleware
app.use('*', async (c, next) => {
  if (c.req.method !== 'OPTIONS') return next();
  const origin = c.req.header('origin') || '';
  const allowed = isAllowedOrigin(origin) || !origin || process.env.NODE_ENV === 'development';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed ? origin : '',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
});

app.use('*', cors({
  origin: (origin) => {
    // No Origin = curl / server-to-server — all routes require Authorization anyway
    if (!origin) return '*';
    if (isAllowedOrigin(origin)) return origin;
    if (process.env.NODE_ENV === 'development') return origin;
    return null;
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));

// Global rate limit: 60 req/min per IP/user — applied to all /api/* routes
app.use('/api/*', generalRateLimit);

// Trial gate: blocks expired-trial users from API calls (migration 0030)
app.use('/api/*', trialGate);

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  logRequest(c.req.method, c.req.path, c.res.status, Date.now() - start);
});

app.onError((err, c) => {
  const status = err instanceof HTTPException ? err.status : 500;
  if (status >= 500) captureError(err, { path: c.req.path, method: c.req.method });
  else logger.warn({ path: c.req.path, status }, err.message);
  return c.json({ error: status === 500 ? 'Internal server error' : err.message }, status);
});

app.get('/version', (c) => {
  return c.json({
    version: process.env.npm_package_version || '0.0.0',
    gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    buildTime: new Date().toISOString(),
    env: process.env.NODE_ENV,
    apiReady: true,
  })
})

app.route('/health', health);


app.route('/api/chat', chat);
app.route('/api/byok-keys', byok);
app.route('/api/projects', projects);
app.route('/api/github', github);
app.route('/api/billing', billing);
app.route('/api/chat/send-to-code', sendToCode);
app.route('/api/notifications', notifications);
app.route('/api/models', models);
app.route('/api/admin', admin);
app.route('/api/deploy', deploy);
app.route('/api/builds', builds);
app.route('/api/users', users);
app.route('/api/templates', templates);
app.route('/api/chat-sessions', chatSessions);
app.route('/api/onboarding', onboarding);
app.route('/api/onboarding-agent', onboardingAgent);
app.route('/api/support', support);
app.route('/api/projects', secrets);
app.route('/api/rankings', rankings);
app.route('/api/admin/rankings', adminRankings);

// 9R — rankings aggregator every 6h (production only)
startCron();

// uncaughtException is truly unrecoverable — exit and let the process manager restart.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception — restarting:', err);
  captureError(err, { type: 'uncaughtException' });
  process.exit(1);
});

// unhandledRejection is often a background fire-and-forget (e.g. a DB insert that timed out).
// Crashing here takes down all concurrent streaming users. Log it, capture it, but stay up.
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[WARN] Unhandled promise rejection (not crashing):', err.message);
  captureError(err, { type: 'unhandledRejection' });
});

const port = parseInt(process.env.PORT || process.env.API_PORT || '3001', 10);
console.log(`Goblin API starting on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`Goblin API listening on port ${port}`);