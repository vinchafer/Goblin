import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * U4 — the redemption contract, asserted against this checkout.
 *
 * The defect the reset chain was built to fix is a link that spends itself when
 * something merely *fetches* it: a mail scanner, a link preview, Gmail's own
 * prefetch. The user then clicks and is told "Reset link expired or already
 * used".
 *
 * That property is structural, not behavioural: it holds iff no code path
 * redeems the token without a human click. A runtime test cannot show the
 * absence of such a path — reading the source can, and that is what this file
 * does. The complementary behavioural check is tests/e2e/32-auth-confirm-
 * interstitial.spec.ts, which drives the deployed app.
 */

const WEB = join(__dirname, '..', '..');
const confirmSrc = readFileSync(join(WEB, 'app/auth/confirm/page.tsx'), 'utf8');
const resetSrc = readFileSync(join(WEB, 'app/auth/reset-password/page.tsx'), 'utf8');

describe('/auth/confirm — a GET must not consume the token', () => {
  it('redeems only from an explicit click', () => {
    expect(confirmSrc).toMatch(/onClick=\{redeem\}/);
  });

  it('has no effect that could redeem on mount', () => {
    // Any useEffect at all on this page would need scrutiny; today there is
    // none, which is the strongest possible form of this guarantee.
    expect(confirmSrc).not.toMatch(/\buseEffect\s*\(/);
  });

  it('calls verifyOtp exactly once in the whole file, inside the click handler', () => {
    // Calls only — the name also appears in the header comment explaining the
    // mechanism, and prose is not a redemption path.
    const calls = confirmSrc.match(/auth\.verifyOtp\s*\(/g) ?? [];
    expect(calls).toHaveLength(1);

    const redeemStart = confirmSrc.indexOf('const redeem = async () =>');
    expect(redeemStart).toBeGreaterThan(-1);
    expect(confirmSrc.indexOf('auth.verifyOtp')).toBeGreaterThan(redeemStart);
  });

  it('guards against a double redemption within one page load', () => {
    expect(confirmSrc).toMatch(/redeemed\.current/);
  });

  it('uses token_hash + verifyOtp, never a PKCE code exchange', () => {
    // verifyOtp needs no code_verifier cookie, which is why the link works in a
    // different browser from the one that requested it — the whole point of U2.
    expect(confirmSrc).toMatch(/token_hash/);
    // The name appears once in the header comment explaining what this page
    // replaced; what must not exist is a CALL.
    expect(confirmSrc).not.toMatch(/exchangeCodeForSession\s*\(/);
  });

  it('honours only a relative `next`, so a crafted link cannot redirect off-site', () => {
    expect(confirmSrc).toContain('/^\\/(?!\\/)/.test(next)');
  });
});

describe('/auth/reset-password — the legacy ?code= links keep working', () => {
  it('still exchanges a PKCE code when one is present', () => {
    // Mails sent before the hook was enabled carry `?code=`. Those users must
    // not be stranded.
    expect(resetSrc).toMatch(/searchParams\.get\('code'\)/);
    expect(resetSrc).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it('and falls through to the session verifyOtp already established', () => {
    expect(resetSrc).toMatch(/no_token|cross_context/);
  });
});
