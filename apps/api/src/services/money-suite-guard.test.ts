/**
 * DD-hardening FW6-U2 — make the money-test skip LOUD.
 *
 * The real-Stripe money suites (proration / subscribe / tier) self-skip via
 * `describe.skip` when no test-mode Stripe key is present:
 *   - account-deletion.test.ts       needs a sk_test_ key
 *   - change-plan.test.ts            needs a key + BUILD/PRO/POWER tier-1 price ids
 *   - change-plan-immediate.test.ts  needs a key + BUILD/PRO/POWER tier-1 price ids
 * All four are required because config/plans.ts throws at import unless BUILD, PRO
 * and POWER tier-1 price ids are all present — so a missing POWER reddens the money
 * suites just as surely as a missing key. The guard therefore requires all four.
 * That skip was SILENT — a green CI run could mean "money paths proven" OR
 * "money paths never ran", indistinguishable. This guard closes that gap: in CI
 * it FAILS LOUDLY, naming the exact missing secrets, so the money suites can
 * never be quietly absent from a passing build.
 *
 * Enforced only when CI === 'true'; locally it warns (non-fatal) so a dev without
 * Stripe keys can still run the rest of the suite. Set ALLOW_MONEY_TEST_SKIP=true
 * to bypass enforcement deliberately (documented escape hatch).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Mirror the money suites' own env-loading so we compute the SAME gate they do.
function loadTestEnv() {
  const envPath = resolve(__dirname, '../../.env.test');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1]) process.env[m[1]] = (m[2] ?? '').trim();
  }
}
loadTestEnv();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const HAS_TEST_KEY = STRIPE_KEY.startsWith('sk_test_');
const PRICE_BUILD_T1 = process.env.STRIPE_PRICE_BUILD_TIER1 ?? '';
const PRICE_PRO_T1 = process.env.STRIPE_PRICE_PRO_TIER1 ?? '';
const PRICE_POWER_T1 = process.env.STRIPE_PRICE_POWER_TIER1 ?? '';

describe('money-suite guard (FW6-U2)', () => {
  it('the real-Stripe money suites must RUN in CI — no silent skip', () => {
    const missing: string[] = [];
    if (!HAS_TEST_KEY) {
      missing.push(
        STRIPE_KEY
          ? 'STRIPE_SECRET_KEY is set but is NOT a test-mode key (must start with sk_test_)'
          : 'STRIPE_SECRET_KEY (test-mode, sk_test_…)',
      );
    }
    if (!PRICE_BUILD_T1) missing.push('STRIPE_PRICE_BUILD_TIER1');
    if (!PRICE_PRO_T1) missing.push('STRIPE_PRICE_PRO_TIER1');
    if (!PRICE_POWER_T1) missing.push('STRIPE_PRICE_POWER_TIER1');

    // Everything present → the money suites will run. Guard passes.
    if (missing.length === 0) return;

    const message =
      'MONEY TESTS ARE SKIPPING — the proration/subscribe/tier suites cannot run.\n'
      + `Missing: ${missing.join(', ')}.\n`
      + 'Add these as GitHub Actions secrets (repo → Settings → Secrets and variables → '
      + 'Actions) and they are wired into the API-tests job in .github/workflows/ci.yml.\n'
      + 'To bypass intentionally on a local run, set ALLOW_MONEY_TEST_SKIP=true.';

    const enforce = process.env.CI === 'true' && process.env.ALLOW_MONEY_TEST_SKIP !== 'true';
    if (enforce) {
      // Fail LOUDLY in CI — a green build must mean the money paths actually ran.
      expect.fail(message);
    } else {
      // Local dev without keys: warn, don't block the rest of the suite.
      // eslint-disable-next-line no-console
      console.warn(`[money-suite-guard] ${message}`);
    }
  });
});
