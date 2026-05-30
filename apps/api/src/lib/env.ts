/**
 * Dev-Safety Shield — environment flags (B3, 2026-05-30).
 *
 * `pnpm dev` runs against PRODUCTION Supabase / Stripe / Vercel — there is no staging
 * backend (founder decision). These flags drive the guards that stop a local dev process
 * from mutating production data outside the dedicated test account.
 *
 * IMPORTANT: NODE_ENV is forced to "production" in .env.local, so it is useless for
 * dev/prod detection. The shield keys off GOBLIN_DEV_MODE exclusively.
 */

/** True when the local process is explicitly flagged as a dev process. */
export const IS_DEV_MODE = process.env.GOBLIN_DEV_MODE === 'true';

/** The only account permitted to be mutated while the shield is active. */
export const TEST_USER_EMAIL = process.env.TEST_ACCOUNT_EMAIL;

/**
 * Vercel project the dev shield permits deploys to touch. Any deploy whose name is this
 * value OR starts with `test-` is allowed; everything else is blocked in dev.
 */
export const VERCEL_ALLOWED_PROJECT = 'synapse-platform';

/**
 * Tables safe to mutate from dev regardless of owner — schema / internal bookkeeping that
 * carries no user data. Kept deliberately tiny; add only with care.
 */
export const DEV_SAFE_TABLES: ReadonlySet<string> = new Set([
  'schema_migrations',
  '_migrations',
  'migrations',
]);

/**
 * Fail fast: an active shield with no test user defined is useless — every write would be
 * blocked. Call once at startup.
 */
export function validateDevShield(): void {
  if (IS_DEV_MODE && !TEST_USER_EMAIL) {
    throw new Error(
      '[DEV-GUARD] GOBLIN_DEV_MODE=true but TEST_ACCOUNT_EMAIL is unset. ' +
        'The dev-safety shield cannot identify the test user. ' +
        'Set TEST_ACCOUNT_EMAIL, or disable the shield with GOBLIN_DEV_MODE=false.',
    );
  }
}

/**
 * Stripe key-mode guard. NODE_ENV is unreliable here (forced to "production" in .env.local),
 * so we gate on IS_DEV_MODE: a live secret key must never be used by a dev process.
 * Returns silently in prod (IS_DEV_MODE=false) so real keys work on Railway.
 */
export function assertStripeKeyMode(): void {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (IS_DEV_MODE && key.startsWith('sk_live_')) {
    throw new Error(
      '[DEV-GUARD] GOBLIN_DEV_MODE=true but STRIPE_SECRET_KEY is a LIVE key (sk_live_). ' +
        'Use sk_test_ keys in dev, or disable the shield with GOBLIN_DEV_MODE=false.',
    );
  }
}
