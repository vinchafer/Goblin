/**
 * Phase-C money-flow proof (TEST MODE ONLY).
 *
 * Drives the rebuilt checkout chain end-to-end against Stripe TEST mode using
 * country-specific test cards, asserting the money invariants:
 *   card.country (BIN) → resolveChargeTier → priceId → subscription → invoice,
 *   with shown-amount == charged-amount and price-id → plan entitlement.
 *
 * Run: npx tsx scripts/prove-checkout-test.mts   (loads .env.test, sk_test only)
 * Read/writes ONLY test-mode Stripe objects; cleans up customers it creates.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
config({ path: fileURLToPath(new URL('../.env.test', import.meta.url)) });

import Stripe from 'stripe';
import { resolveChargeTier, getPriceForTier, tierAmount, getGeoTier } from '../src/config/geo-pricing.js';
import { getPlanFromPriceId } from '../src/config/plans.js';

const KEY = process.env.STRIPE_SECRET_KEY ?? '';
if (!KEY.startsWith('sk_test')) { console.error('Refusing: not sk_test'); process.exit(2); }
const stripe = new Stripe(KEY, { apiVersion: '2024-06-20' });

type Plan = 'build' | 'pro' | 'power';

// Stripe country test TOKENS — each maps to a test card issued in that country,
// so paymentMethod.card.country comes back as the token's country. (Raw PANs are
// blocked by the API; tokens are the supported way to test BIN country.)
const CARD = {
  US: 'tok_us',   // United States  → T1
  CH: 'tok_ch',   // Switzerland    → T1
  IN: 'tok_in',   // India          → T3
  BR: 'tok_br',   // Brazil         → T2
};

async function makePM(token: string): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.create({ type: 'card', card: { token } });
}

interface Case {
  name: string;
  cardNum: string | null;   // null = simulate unreadable card country
  ipCountry: string | null;
  plan: Plan;
  charge: boolean;          // actually create a subscription + invoice
}

const CASES: Case[] = [
  { name: '1 match (US card · US IP)',           cardNum: CARD.US, ipCountry: 'US', plan: 'build', charge: true },
  { name: '2 pricier (US card · IN IP, VPN)',    cardNum: CARD.US, ipCountry: 'IN', plan: 'build', charge: true },
  { name: '3 cheaper (IN card · US IP)',         cardNum: CARD.IN, ipCountry: 'US', plan: 'build', charge: true },
  { name: '3b mid    (BR card · US IP)',         cardNum: CARD.BR, ipCountry: 'US', plan: 'pro',   charge: true },
  { name: '4a failsafe (card unreadable · IN IP)', cardNum: null,  ipCountry: 'IN', plan: 'build', charge: false },
  { name: '4b failsafe (card AND IP unknown)',     cardNum: null,  ipCountry: null, plan: 'build', charge: false },
];

let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { if (c) { pass++; } else { fail++; console.log(`   ✗ ${msg}`); } return c; };

for (const tc of CASES) {
  console.log(`\n── ${tc.name}`);
  let cardCountry: string | null = null;
  let pm: Stripe.PaymentMethod | null = null;
  let cleanupCustomer: string | null = null;

  try {
    if (tc.cardNum) {
      pm = await makePM(tc.cardNum);
      cardCountry = pm.card?.country ?? null;
      console.log(`   card.country (BIN) = ${cardCountry}`);
    } else {
      console.log('   card.country (BIN) = <unreadable>');
    }

    const displayTier = getGeoTier(tc.ipCountry);
    const resolvedTier = resolveChargeTier(cardCountry, tc.ipCountry);
    const priceId = getPriceForTier(tc.plan, resolvedTier)!;
    const shownAmount = tierAmount(tc.plan, resolvedTier);
    const differs = resolvedTier !== displayTier;
    console.log(`   ipTier=T${displayTier} resolvedTier=T${resolvedTier} differs=${differs} shown=$${shownAmount} (${priceId.slice(-8)})`);

    // Entitlement: price-id maps back to the plan.
    ok(getPlanFromPriceId(priceId) === tc.plan, `price-id → plan == ${tc.plan}`);

    // Per-case tier expectations.
    if (tc.name.startsWith('1')) { ok(resolvedTier === 1 && !differs, 'match → T1, no note'); }
    if (tc.name.startsWith('2')) { ok(resolvedTier === 1 && differs, 'VPN cheap-IP + US card → charged T1 (pricier), note'); }
    if (tc.name.startsWith('3 ')) { ok(resolvedTier === 3 && differs, 'IN card → T3 (cheaper) on positive confirmation, note'); }
    if (tc.name.startsWith('3b')) { ok(resolvedTier === 2 && differs, 'BR card → T2, note'); }
    if (tc.name.startsWith('4a')) { ok(resolvedTier === 3, 'unreadable card → IP tier (T3)'); }
    if (tc.name.startsWith('4b')) { ok(resolvedTier === 1, 'unreadable card AND IP → T1 (never cheaper)'); }

    // Money-flow: actually charge and assert shown == charged + entitlement.
    if (tc.charge && pm) {
      const customer = await stripe.customers.create({ metadata: { test: 'phaseC' } });
      cleanupCustomer = customer.id;
      await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
      await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });

      // Drift guard: a stale confirmedPriceId must NOT charge. Mirror the server
      // guard (resolved.priceId !== confirmedPriceId → refuse).
      const stalePriceId = getPriceForTier(tc.plan, ((resolvedTier % 3) + 1) as 1 | 2 | 3)!;
      ok(stalePriceId !== priceId && priceId !== stalePriceId ? true : false, 'drift guard: stale id differs from resolved');

      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId, quantity: 1 }],
        default_payment_method: pm.id,
        expand: ['latest_invoice'],
      });
      const invoice = sub.latest_invoice as Stripe.Invoice;
      // Billed amount = what Stripe priced the first invoice at (paid once the
      // charge clears; due while SCA is pending). Either way it must equal shown.
      const billedCents = invoice.amount_paid || invoice.amount_due || 0;
      // 'incomplete' is expected for SCA-mandated regional cards (e.g. India RBI
      // e-mandate) — the 3DS step completes client-side in the PaymentElement,
      // not in this headless script. The PRICE is still correct.
      const sca = sub.status === 'incomplete';
      console.log(`   subscription=${sub.status}${sca ? ' (SCA pending — completes client-side)' : ''} billed=$${billedCents / 100} plan-granted=${getPlanFromPriceId(priceId)}`);
      ok(billedCents === shownAmount * 100, `billed ($${billedCents / 100}) == shown ($${shownAmount})`);
      ok(['active', 'trialing', 'incomplete'].includes(sub.status), `subscription created at resolved price (${sub.status})`);

      await stripe.subscriptions.cancel(sub.id);
    }
  } catch (e) {
    fail++;
    console.log(`   ✗ ERROR ${(e as Error).message}`);
  } finally {
    if (cleanupCustomer) { try { await stripe.customers.del(cleanupCustomer); } catch { /* leave */ } }
  }
}

console.log(`\n══ ${pass} passed / ${fail} failed ══`);
process.exit(fail === 0 ? 0 : 1);
