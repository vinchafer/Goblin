// Soft-delete grace period, in days. Single source for all user-facing deletion
// copy on the web so the number can never drift.
//
// MUST stay in sync with the backend constant of record:
//   apps/api/src/services/account-deletion.ts → GRACE_PERIOD_DAYS
// (separate build, so it can't be imported directly; the API email already
// derives its copy from the backend constant.)
export const GRACE_PERIOD_DAYS = 10;
