import logger from './logger';
import { runRankingsAggregator } from './rankings/aggregator';
import { hardDeletePendingAccounts } from '../jobs/hard-delete-pending-accounts';

let scheduled = false;

/**
 * Lightweight in-process scheduler. No-op unless ENABLE_CRON=true.
 * Rankings aggregator: every 6h (00, 06, 12, 18 UTC).
 * Hard-delete pending accounts: daily at 03:00 UTC.
 */
export function startCron(): void {
  if (scheduled) return;
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('cron disabled (ENABLE_CRON != true)');
    return;
  }

  let lastRankingsSlot = -1;
  let lastHardDeleteDay = -1;

  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDate();

    const slot = Math.floor(utcHour / 6);
    if (utcHour % 6 === 0 && utcMinute < 2 && lastRankingsSlot !== slot) {
      lastRankingsSlot = slot;
      logger.info('cron tick — firing rankings aggregator');
      runRankingsAggregator().catch((e) =>
        logger.error({ error: (e as Error).message }, 'cron rankings failed'),
      );
    }

    if (utcHour === 3 && utcMinute < 2 && lastHardDeleteDay !== utcDay) {
      lastHardDeleteDay = utcDay;
      logger.info('cron tick — firing hard-delete pending accounts');
      hardDeletePendingAccounts()
        .then((result) => logger.info(result, 'hard-delete cron: completed'))
        .catch((e) =>
          logger.error({ error: (e as Error).message }, 'cron hard-delete failed'),
        );
    }
  }, 60_000);

  scheduled = true;
  logger.info('cron scheduled — rankings every 6h, hard-delete daily 03:00 UTC');
}
