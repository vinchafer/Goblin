import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) => {
  const services = {
    supabase: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'connected' as const : 'missing_config' as const,
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' as const : 'missing_config' as const,
    storage: process.env.SUPABASE_URL ? 'configured' as const : 'missing_config' as const,
  };

  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services,
  });
});

export { health };