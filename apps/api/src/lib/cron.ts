import logger from './logger';
import { runRankingsAggregator } from './rankings/aggregator';

let scheduled = false;

/**
 * Lightweight in-process scheduler. No-op unless ENABLE_CRON=true.
 * Rankings aggregator: every 6h (00, 06, 12, 18 UTC).
 */
export function startCron(): void {
  if (scheduled) return;
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('cron disabled (ENABLE_CRON != true)');
    return;
  }

  let lastRankingsSlot = -1;
  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    const slot = Math.floor(utcHour / 6);
    if (utcHour % 6 === 0 && utcMinute < 2 && lastRankingsSlot !== slot) {
      lastRankingsSlot = slot;
      logger.info('cron tick — firing rankings aggregator');
      runRankingsAggregator().catch((e) =>
        logger.error({ error: (e as Error).message }, 'cron rankings failed'),
      );
    }
  }, 60_000);

  scheduled = true;
  logger.info('cron scheduled — rankings every 6h');
}
