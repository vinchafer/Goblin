import logger from './logger';
import { runEvalSuite } from './eval/runner';

let scheduled = false;

/**
 * Lightweight in-process scheduler. Daily at 04:00 UTC.
 * Uses setInterval (1 min tick) rather than a cron lib to avoid an extra dep.
 * No-op outside production.
 */
export function startCron(): void {
  if (scheduled) return;
  if (process.env.NODE_ENV !== 'production') {
    logger.info('cron disabled (NODE_ENV != production)');
    return;
  }

  let lastFiredDay = -1;
  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDate();
    if (utcHour === 4 && utcMinute < 2 && lastFiredDay !== utcDay) {
      lastFiredDay = utcDay;
      logger.info('cron tick — firing eval suite');
      runEvalSuite().catch((e) => logger.error({ error: (e as Error).message }, 'cron eval failed'));
    }
  }, 60_000);

  scheduled = true;
  logger.info('cron scheduled — daily 04:00 UTC');
}
