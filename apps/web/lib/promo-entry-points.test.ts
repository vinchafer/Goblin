/**
 * FINAL-POLISH · U3 — the invite code is asked for in ONE place.
 *
 * Founder decision: entering the code at signup and then being asked for it again on the
 * plan/trial dialog was frustrating and confusing, and it made single-use look broken (see
 * U2). The signup entry is removed; the paywall (plan/trial dialog) and the settings
 * billing field stay.
 *
 * Asserted against the source, the way redemption-contract.test.ts does: "this field is
 * gone" is a structural property, and reading the checkout is the way to show an absence.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const loginSrc = read('app/(auth)/login/page.tsx');
const trialGateSrc = read('app/dashboard/trial-gate/page.tsx');
const billingSrc = read('components/settings/BillingPage.tsx');
const shellSrc = read('components/app-shell/dashboard-shell.tsx');

describe('U3 — the signup form no longer offers an invite-code field', () => {
  it('has no promo input and no promo state', () => {
    expect(loginSrc).not.toMatch(/setPromoCode/);
    expect(loginSrc).not.toMatch(/useState\([^)]*\)\s*;\s*\/\/\s*promo/i);
    expect(loginSrc).not.toMatch(/Goblin-Code \(optional\)/);
    expect(loginSrc).not.toMatch(/Goblin code \(optional\)/);
  });

  it('leaves no orphaned handler or import behind', () => {
    // The stash was the only reason login knew about the pending-promo contract.
    expect(loginSrc).not.toMatch(/PENDING_PROMO_KEY/);
    expect(loginSrc).not.toMatch(/from '@\/lib\/promo-redeem'/);
    expect(loginSrc).not.toMatch(/redeemPromoCode/);
  });

  it('still signs the user up — the removal touched nothing else on that path', () => {
    expect(loginSrc).toMatch(/supabase\.auth\.signUp\(/);
    expect(loginSrc).toMatch(/setEmailSent\(true\)/);
    expect(loginSrc).toMatch(/termsAccepted/); // the Terms gate is untouched
  });
});

describe('U3 — the code is still enterable where it should be', () => {
  it('the plan/trial dialog offers the field', () => {
    expect(trialGateSrc).toMatch(/import \{ PromoCodeField \}/);
    expect(trialGateSrc).toMatch(/<PromoCodeField/);
  });

  it('the settings billing screen offers it too', () => {
    expect(billingSrc).toMatch(/<PromoCodeField \/>/);
  });
});

describe('U3 — an account that already has access is never asked for a code', () => {
  it('the settings field is hidden once the account is comped', () => {
    expect(billingSrc).toMatch(/\{!isComped && <PromoCodeField \/>\}/);
  });

  it('the plan/trial dialog bounces an entitled account instead of prompting it', () => {
    // A comped account reports trialStatus 'subscribed' (users.ts: is_comped → subscribed),
    // and the gate sends it straight back to the dashboard — the code prompt never renders.
    expect(trialGateSrc).toMatch(
      /trialStatus === 'subscribed' \|\| info\.trialStatus === 'active'[\s\S]{0,120}router\.replace\('\/dashboard'\)/,
    );
  });

  it('the shell only ever routes UN-entitled accounts to the gate', () => {
    const redirect = shellSrc.match(
      /if \(info\.trialStatus === [\s\S]{0,200}?router\.replace\('\/dashboard\/trial-gate'\)/,
    );
    expect(redirect).not.toBeNull();
    const clause = redirect![0];
    for (const unentitled of ['not_started', 'expired', 'none']) {
      expect(clause).toContain(unentitled);
    }
    // The two entitled states must NOT appear as redirect triggers.
    expect(clause).not.toContain("'subscribed'");
    expect(clause).not.toContain("'active'");
  });
});
