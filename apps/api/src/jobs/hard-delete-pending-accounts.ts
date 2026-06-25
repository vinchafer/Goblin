// The hard-delete cron now delegates to the canonical account-deletion service
// (services/account-deletion.ts), which blocks the irreversible purge while a
// live Stripe subscription could still bill. Re-exported here to keep the cron
// import path (lib/cron.ts) stable.
export {
  hardDeletePendingAccounts,
  type HardDeleteResult,
} from '../services/account-deletion';
