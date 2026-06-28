// One-time storage backfill — populate users.storage_bytes with the true B2 sum
// after applying migration 0073, so the cap is correct immediately rather than only
// after the first nightly reconcile. Idempotent: safe to re-run (same recompute).
// Run: pnpm --filter @goblin/api exec tsx src/scripts/backfill-storage.ts
import '../load-env.js';
import { reconcileStorage } from '../jobs/reconcile-storage.js';

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

(async () => {
  log('storage backfill — recomputing every user counter from B2…');
  const result = await reconcileStorage({ backfill: true });
  log(`done — usersScanned=${result.usersScanned} corrected=${result.corrected}`);
  process.exit(0);
})().catch((e) => {
  console.error('backfill failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
