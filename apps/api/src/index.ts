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
  'STRIPE_PRICE_SEED',
  'STRIPE_PRICE_CRAFT',
  'STRIPE_PRICE_FORGE',
]

// Optional env vars for Free-API Pool (Layer 2 routing)
// GOOGLE_FREE_API_KEY=          # Gemini 2.0 Flash
// GROQ_FREE_API_KEY=            # Llama 3.3 70B
// CEREBRAS_FREE_API_KEY=        # Llama 3.3 70B
// OPENROUTER_FREE_API_KEY=      # Various free models

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

// Wildcard patterns compiled to anchored regexes
const CORS_PATTERNS = [
  /^https:\/\/[^./]+\.vercel\.app$/,
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

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});

const port = parseInt(process.env.PORT || process.env.API_PORT || '3001', 10);
console.log(`Goblin API starting on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`Goblin API listening on port ${port}`);