import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const health = new Hono();
const START_TIME = Date.now();

health.get('/', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.npm_package_version ?? '0.0.1',
}));

health.get('/deep', async (c) => {
  const checks: Record<string, { status: 'ok' | 'fail' | 'skip'; latencyMs?: number }> = {};
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
  let criticalFailed = false;

  // Supabase
  const sbStart = Date.now();
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('projects').select('id').limit(1);
    checks.supabase = { status: error ? 'fail' : 'ok', latencyMs: Date.now() - sbStart };
    if (error) { overallStatus = 'degraded'; criticalFailed = true; }
  } catch {
    checks.supabase = { status: 'fail', latencyMs: Date.now() - sbStart };
    overallStatus = 'down'; criticalFailed = true;
  }

  // Storage
  const storageEndpoint = process.env.STORAGE_ENDPOINT;
  if (storageEndpoint) {
    const t = Date.now();
    try {
      const res = await fetch(`${storageEndpoint}/health`, { signal: AbortSignal.timeout(3000) });
      checks.storage = { status: res.ok ? 'ok' : 'fail', latencyMs: Date.now() - t };
      if (!res.ok && overallStatus === 'ok') overallStatus = 'degraded';
    } catch {
      checks.storage = { status: 'fail', latencyMs: Date.now() - t };
      if (overallStatus === 'ok') overallStatus = 'degraded';
    }
  } else {
    checks.storage = { status: 'skip' };
  }

  // LiteLLM
  const litellmUrl = process.env.LITELLM_BASE_URL;
  if (litellmUrl) {
    const t = Date.now();
    try {
      const res = await fetch(`${litellmUrl}/health`, { signal: AbortSignal.timeout(3000) });
      checks.litellm = { status: res.ok ? 'ok' : 'fail', latencyMs: Date.now() - t };
      if (!res.ok && overallStatus === 'ok') overallStatus = 'degraded';
    } catch {
      checks.litellm = { status: 'fail', latencyMs: Date.now() - t };
      if (overallStatus === 'ok') overallStatus = 'degraded';
    }
  } else {
    checks.litellm = { status: 'skip' };
  }

  // Stripe (just check env var presence)
  checks.stripe = { status: process.env.STRIPE_SECRET_KEY ? 'ok' : 'skip' };

  return c.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.npm_package_version ?? '0.0.1',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      checks,
    },
    overallStatus === 'down' ? 503 : 200
  );
});

export { health };
