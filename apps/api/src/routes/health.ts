import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const health = new Hono();

health.get('/', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version ?? '0.0.1',
}));

// Deep health check — verifies external dependencies
health.get('/deep', async (c) => {
  const checks: Record<string, 'ok' | 'fail' | 'skip'> = {};
  let allOk = true;

  // Supabase
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('projects').select('id').limit(1);
    checks.supabase = error ? 'fail' : 'ok';
    if (error) allOk = false;
  } catch {
    checks.supabase = 'fail';
    allOk = false;
  }

  // Storage (Hetzner / S3-compatible)
  const storageEndpoint = process.env.STORAGE_ENDPOINT;
  if (storageEndpoint) {
    try {
      const res = await fetch(`${storageEndpoint}/health`, { signal: AbortSignal.timeout(3000) });
      checks.storage = res.ok ? 'ok' : 'fail';
      if (!res.ok) allOk = false;
    } catch {
      checks.storage = 'fail';
      allOk = false;
    }
  } else {
    checks.storage = 'skip';
  }

  // LiteLLM / model router
  const litellmUrl = process.env.LITELLM_URL;
  if (litellmUrl) {
    try {
      const res = await fetch(`${litellmUrl}/health`, { signal: AbortSignal.timeout(3000) });
      checks.litellm = res.ok ? 'ok' : 'fail';
      if (!res.ok) allOk = false;
    } catch {
      checks.litellm = 'fail';
      allOk = false;
    }
  } else {
    checks.litellm = 'skip';
  }

  return c.json(
    {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
      checks,
    },
    allOk ? 200 : 503
  );
});

export { health };
