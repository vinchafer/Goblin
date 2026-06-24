#!/usr/bin/env node
/**
 * LIVE Stripe price verification by listing (no local live ids needed).
 * Uses STRIPE_SECRET_KEY_2 (rk_live_, read-only). Lists active prices, maps each
 * to plan×tier by product + unit_amount, asserts against the spec matrix.
 * Never prints the key; price ids shown last8 only. READ-ONLY (list/retrieve).
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY_2;
if (!KEY) { console.error('✗ STRIPE_SECRET_KEY_2 not set'); process.exit(2); }
const stripe = new Stripe(KEY, { apiVersion: '2024-06-20' });

// spec: amount(cents) -> [plan, tier]. NOTE 700 is ambiguous (build T2 vs pro T3)
// so we disambiguate by product/plan, not amount alone.
const SPEC = {
  build: { 1: 1100, 2: 700,  3: 400  },
  pro:   { 1: 1900, 2: 1200, 3: 700  },
  power: { 1: 3900, 2: 2500, 3: 1400 },
};
const tail = (s) => (s ? `…${String(s).slice(-8)}` : '(none)');

// classify a product name into a plan
function planOf(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('build')) return 'build';
  if (n.includes('power')) return 'power';
  if (n.includes('pro'))   return 'pro';
  return null;
}

const prices = [];
for await (const p of stripe.prices.list({ active: true, expand: ['data.product'], limit: 100 })) {
  prices.push(p);
}

console.log(`\nFetched ${prices.length} active live prices.\n`);
console.log('product               price-id      amount    cur  interval  active  plan');
console.log('--------------------  ------------  --------  ---  --------  ------  -----');
const byPlanAmount = new Map();
for (const p of prices) {
  const prod = typeof p.product === 'object' ? p.product : null;
  const plan = planOf(prod?.name);
  console.log(
    `${(prod?.name || '?').slice(0, 20).padEnd(20)}  ${tail(p.id).padEnd(12)}  ` +
    `${String(p.unit_amount).padEnd(8)}  ${p.currency.padEnd(3)}  ` +
    `${(p.recurring?.interval || '-').padEnd(8)}  ${String(p.active).padEnd(6)}  ${plan || '?'}`
  );
  if (plan) byPlanAmount.set(`${plan}:${p.unit_amount}`, p);
}

console.log('\nLIVE verification table\n');
console.log('plan·tier  price-id      amount        currency  interval  active  product-active  MATCHES');
console.log('---------  ------------  ------------  --------  --------  ------  --------------  -------');
let pass = 0, fail = 0;
for (const plan of ['build', 'pro', 'power']) {
  for (const tier of [1, 2, 3]) {
    const want = SPEC[plan][tier];
    const p = byPlanAmount.get(`${plan}:${want}`);
    if (!p) { fail++; console.log(`${plan} T${tier}    (none)        want ${want}    -         -         -       -               ✗ MISSING`); continue; }
    const prod = typeof p.product === 'object' ? p.product : null;
    const ok = p.unit_amount === want && p.currency === 'usd' && p.recurring?.interval === 'month' && p.active === true && prod?.active === true;
    if (ok) pass++; else fail++;
    console.log(
      `${plan} T${tier}    ${tail(p.id).padEnd(12)}  ${String(p.unit_amount).padEnd(12)}  ` +
      `${p.currency.padEnd(8)}  ${(p.recurring?.interval||'-').padEnd(8)}  ${String(p.active).padEnd(6)}  ${String(prod?.active).padEnd(14)}  ${ok ? '✓' : '✗'}`
    );
  }
}
console.log(`\n${pass}/${pass + fail} LIVE MATCHES`);
process.exit(fail === 0 ? 0 : 1);
