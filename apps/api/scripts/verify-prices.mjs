#!/usr/bin/env node
/**
 * Stripe price verification — TEST or LIVE.
 *
 * Verifies the 9 regional price objects (3 plans × 3 tiers) match the agreed
 * display matrix on the Stripe side: unit_amount, currency, interval, active,
 * and that the product is active.
 *
 * Run from apps/api (so the `stripe` package resolves). Easiest via an env file:
 *
 *   cd apps/api
 *   node --env-file=./.env.live scripts/verify-prices.mjs
 *
 * …where .env.live holds STRIPE_SECRET_KEY=rk_live_… plus the 9 LIVE ids
 * STRIPE_PRICE_{BUILD,PRO,POWER}_TIER{1,2,3}=price_…
 *
 * A RESTRICTED, READ-ONLY key (rk_live_…, Prices + Products read) is sufficient.
 * The script never prints the key and only prints the last 8 chars of price ids.
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) { console.error('✗ STRIPE_SECRET_KEY not set'); process.exit(2); }
const MODE = KEY.includes('live') ? 'LIVE' : 'TEST';

const stripe = new Stripe(KEY, { apiVersion: '2024-06-20' });

// Expected matrix (USD cents) — single source of truth for this check.
const EXPECT = {
  build: { 1: 1100, 2: 700,  3: 400  },
  pro:   { 1: 1900, 2: 1200, 3: 700  },
  power: { 1: 3900, 2: 2500, 3: 1400 },
};

const tail = (s) => (s ? `…${s.slice(-8)}` : '(unset)');
let pass = 0, fail = 0;
const rows = [];

for (const plan of ['build', 'pro', 'power']) {
  for (const tier of [1, 2, 3]) {
    const envName = `STRIPE_PRICE_${plan.toUpperCase()}_TIER${tier}`;
    const id = process.env[envName];
    const want = EXPECT[plan][tier];
    if (!id) { fail++; rows.push([plan, tier, '(unset)', '—', 'FAIL: env unset']); continue; }
    try {
      const p = await stripe.prices.retrieve(id, { expand: ['product'] });
      const okAmount   = p.unit_amount === want;
      const okCurrency = p.currency === 'usd';
      const okInterval = p.recurring?.interval === 'month';
      const okActive   = p.active === true;
      const okProduct  = typeof p.product === 'object' && p.product.active === true;
      const ok = okAmount && okCurrency && okInterval && okActive && okProduct;
      if (ok) pass++; else fail++;
      rows.push([plan, tier, tail(id), `${p.unit_amount} ${p.currency}/${p.recurring?.interval}`,
        ok ? 'PASS' : `FAIL${okAmount ? '' : ` amount≠${want}`}${okCurrency ? '' : ' cur'}${okInterval ? '' : ' int'}${okActive ? '' : ' inactive'}${okProduct ? '' : ' prod'}`]);
    } catch (e) {
      fail++;
      rows.push([plan, tier, tail(id), '—', `FAIL: ${e.message}`]);
    }
  }
}

console.log(`\nStripe price verification — ${MODE} mode\n`);
console.log('plan   tier  price-id      amount            result');
console.log('-----  ----  ------------  ----------------  ------');
for (const [plan, tier, id, amt, res] of rows) {
  console.log(`${plan.padEnd(5)}  ${String(tier).padEnd(4)}  ${id.padEnd(12)}  ${String(amt).padEnd(16)}  ${res}`);
}
console.log(`\n${pass}/${pass + fail} PASS (${MODE})`);
process.exit(fail === 0 ? 0 : 1);
