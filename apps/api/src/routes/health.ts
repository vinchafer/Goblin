import { Hono } from 'hono';
import { scryptSync } from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { log } from '../lib/logger';

const health = new Hono();
const START_TIME = Date.now();

health.get('/', async (c) => {
  const services: Record<string, 'ok' | 'degraded' | 'error'> = {};
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';

  // Database check
  try {
    await supabaseAdmin.from('users').select('id').limit(1);
    services.db = 'ok';
  } catch (err) {
    services.db = 'error';
    overallStatus = 'error';
    log('error', 'Health check: database failure', { error: (err as Error).message });
  }

  // Stripe config check
  services.stripe = process.env.STRIPE_SECRET_KEY ? 'ok' : 'degraded';
  if (services.stripe === 'degraded' && overallStatus === 'ok') {
    overallStatus = 'degraded';
  }

  // Encryption key check
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('Missing key');
    
    // Verify key can derive
    scryptSync(encryptionKey, 'goblin-salt-v1', 32);
    services.encryption = 'ok';
  } catch {
    services.encryption = 'degraded';
    if (overallStatus === 'ok') {
      overallStatus = 'degraded';
    }
  }

  const uptime = Date.now() - START_TIME;

  if (overallStatus === 'error') {
    return c.json({ status: 'error', services, uptime }, 503);
  }

  if (overallStatus === 'degraded') {
    return c.json({ status: 'degraded', services, uptime }, 207);
  }

  return c.json({ status: 'ok', services, uptime });
});

export { health };