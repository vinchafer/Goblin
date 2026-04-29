import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: join(__dirname, '../../../.env') });

// Startup validation — fail fast with clear error messages
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'ENCRYPTION_KEY',
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

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return '*';
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://goblin-web.vercel.app',
      'https://goblin-web-git-*.vercel.app',
      'https://justgoblin.com',
      'https://www.justgoblin.com',
      process.env.NEXT_PUBLIC_APP_URL
    ].filter((origin): origin is string => !!origin);
    
    // Check if the origin matches any allowed pattern
    if (allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return origin === allowed;
    })) {
      return origin;
    }
    
    // For development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return origin;
    }
    
    return null;
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400, // 24 hours
}));

app.onError((err, c) => {
  console.error('[API Error]', err.message);
  const status = err instanceof HTTPException ? err.status : 500;
  return c.json({ 
    error: status === 500 ? 'Internal server error' : err.message 
  }, status);
});

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

const port = parseInt(process.env.API_PORT || '3001', 10);
console.log(`Goblin API starting on port ${port}`);
serve({
  fetch: app.fetch,
  port
});