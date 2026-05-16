import logger from './logger';

/**
 * Pings the Better-Stack heartbeat URL. No-op when URL not configured.
 * Used by eval runner after successful daily run — Better-Stack alerts
 * if no ping arrives within (interval + grace).
 */
export async function pingHeartbeat(): Promise<void> {
  const url = process.env.BETTERSTACK_HEARTBEAT_URL;
  if (!url) {
    logger.debug('heartbeat skipped — BETTERSTACK_HEARTBEAT_URL not set');
    return;
  }
  try {
    await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    logger.info('heartbeat ping ok');
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'heartbeat ping failed');
  }
}
