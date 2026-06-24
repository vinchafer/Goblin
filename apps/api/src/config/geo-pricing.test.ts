import { describe, it, expect } from 'vitest';
import {
  getGeoTier,
  authoritativeTier,
  resolveChargeTier,
  tierAmount,
  getPriceForTier,
  PLAN_PRICES,
} from './geo-pricing';
import { getPlanFromPriceId } from './plans';

describe('getGeoTier — World Bank income classification', () => {
  it('US (high income) → Tier 1', () => {
    expect(getGeoTier('US')).toBe(1);
  });

  it('BR (upper-middle income) → Tier 2', () => {
    expect(getGeoTier('BR')).toBe(2);
  });

  it('IN (lower-middle income) → Tier 3', () => {
    expect(getGeoTier('IN')).toBe(3);
  });

  it('low-income country (e.g. NE Niger) → Tier 3', () => {
    expect(getGeoTier('NE')).toBe(3);
  });

  it('TW (override, not in WB list) → Tier 1', () => {
    expect(getGeoTier('TW')).toBe(1);
  });

  it('VE (override, WB-unclassified) → Tier 2', () => {
    expect(getGeoTier('VE')).toBe(2);
  });

  it('ET (override, WB-unclassified) → Tier 3', () => {
    expect(getGeoTier('ET')).toBe(3);
  });

  it('lowercase input is normalised', () => {
    expect(getGeoTier('de')).toBe(1);
    expect(getGeoTier('in')).toBe(3);
  });

  it('null / unknown country → Tier 1 (never under-charge)', () => {
    expect(getGeoTier(null)).toBe(1);
    expect(getGeoTier('ZZ')).toBe(1);
  });

});

describe('authoritativeTier — anti-VPN enforcement (card country wins)', () => {
  // Mock matrix: country of the *card* drives the tier (B3).
  it.each([
    ['US', 1],
    ['BR', 2],
    ['IN', 3],
    ['TW', 1],
    ['VE', 2],
    ['ET', 3],
  ] as const)('card %s → Tier %i (regardless of IP)', (country, tier) => {
    // IP claims Tier 1 (e.g. US) in every case; card must override it.
    expect(authoritativeTier(country, 1)).toBe(tier);
  });

  it('VPN US-IP (T1) + IN card → IN tier T3 (card wins, even cheaper)', () => {
    expect(authoritativeTier('IN', 1)).toBe(3);
  });

  it('cheap IP (T3) + US card → US tier T1 (card wins, defeats VPN)', () => {
    expect(authoritativeTier('US', 3)).toBe(1);
  });

  it('unknown card → falls back to the IP tier (unknown IP → T1)', () => {
    expect(authoritativeTier(null, 2)).toBe(2);
    expect(authoritativeTier(null, 1)).toBe(1);
  });
});

describe('resolveChargeTier — fail-safe ordering (card → IP → T1)', () => {
  it('card country present → card tier (authoritative, may be cheaper)', () => {
    expect(resolveChargeTier('IN', 'US')).toBe(3); // IN card on US IP → IN tier (positive confirmation)
    expect(resolveChargeTier('US', 'IN')).toBe(1); // US card on IN IP → US tier (defeats VPN)
    expect(resolveChargeTier('CH', 'IN')).toBe(1); // CH card → T1
  });

  it('card country unreadable → IP tier', () => {
    expect(resolveChargeTier(null, 'IN')).toBe(3);
    expect(resolveChargeTier(null, 'BR')).toBe(2);
    expect(resolveChargeTier(null, 'US')).toBe(1);
  });

  it('both card AND IP unresolvable → Tier 1 (last resort, never cheaper)', () => {
    expect(resolveChargeTier(null, null)).toBe(1);
    expect(resolveChargeTier(null, 'ZZ')).toBe(1);
  });

  it('uncertainty never grants a discount without a confirmed card', () => {
    // No card + unknown IP must NOT land on a cheap tier — always T1.
    expect(resolveChargeTier(null, null)).toBe(1);
    // A cheaper tier (T3) is only ever reached via a positively-read card country.
    expect(resolveChargeTier('IN', null)).toBe(3);
  });
});

describe('tierAmount — charged dollars match the display matrix', () => {
  it('returns PLAN_PRICES dollars per plan × tier', () => {
    expect(tierAmount('build', 1)).toBe(11);
    expect(tierAmount('build', 3)).toBe(4);
    expect(tierAmount('pro', 2)).toBe(12);
    expect(tierAmount('power', 1)).toBe(39);
    expect(tierAmount('power', 3)).toBe(14);
  });
});

describe('B4 entitlement chain — card country → tier → price-id → plan', () => {
  // The webhook reconciles to the card tier, then maps the resulting price-id
  // back to a plan. Prove the whole chain grants the correct plan for every tier.
  it('each tier price-id maps back to its plan', () => {
    process.env.STRIPE_PRICE_BUILD_TIER1 = 'price_build_t1';
    process.env.STRIPE_PRICE_BUILD_TIER2 = 'price_build_t2';
    process.env.STRIPE_PRICE_BUILD_TIER3 = 'price_build_t3';
    process.env.STRIPE_PRICE_PRO_TIER1 = 'price_pro_t1';
    process.env.STRIPE_PRICE_PRO_TIER2 = 'price_pro_t2';
    process.env.STRIPE_PRICE_PRO_TIER3 = 'price_pro_t3';
    process.env.STRIPE_PRICE_POWER_TIER1 = 'price_power_t1';
    process.env.STRIPE_PRICE_POWER_TIER2 = 'price_power_t2';
    process.env.STRIPE_PRICE_POWER_TIER3 = 'price_power_t3';

    // VPN-US-IP + IN card, plan=pro: authoritative tier = T3, price = pro_t3,
    // which must still grant the 'pro' plan.
    const tier = authoritativeTier('IN', 1);
    const priceId = getPriceForTier('pro', tier);
    expect(priceId).toBe('price_pro_t3');
    expect(getPlanFromPriceId(priceId!)).toBe('pro');

    // Spot-check the other plans at their pricier (card) tiers.
    expect(getPlanFromPriceId(getPriceForTier('build', authoritativeTier('US', 3))!)).toBe('build');
    expect(getPlanFromPriceId(getPriceForTier('power', authoritativeTier('BR', 1))!)).toBe('power');
  });
});

describe('PLAN_PRICES — display matrix (regional re-wire)', () => {
  it('Tier 1: Build $11 · Pro $19 · Power $39', () => {
    expect(PLAN_PRICES.build[1]).toBe(11);
    expect(PLAN_PRICES.pro[1]).toBe(19);
    expect(PLAN_PRICES.power[1]).toBe(39);
  });

  it('Tier 2: Build $7 · Pro $12 · Power $25', () => {
    expect(PLAN_PRICES.build[2]).toBe(7);
    expect(PLAN_PRICES.pro[2]).toBe(12);
    expect(PLAN_PRICES.power[2]).toBe(25);
  });

  it('Tier 3: Build $4 · Pro $7 · Power $14', () => {
    expect(PLAN_PRICES.build[3]).toBe(4);
    expect(PLAN_PRICES.pro[3]).toBe(7);
    expect(PLAN_PRICES.power[3]).toBe(14);
  });
});

describe('getPriceForTier — env price-ID resolution', () => {
  it('falls back to Tier 1 env id when a tier is unconfigured', () => {
    process.env.STRIPE_PRICE_BUILD_TIER1 = 'price_t1';
    delete process.env.STRIPE_PRICE_BUILD_TIER2;
    expect(getPriceForTier('build', 2)).toBe('price_t1');
  });

  it('returns the matching tier env id when configured', () => {
    process.env.STRIPE_PRICE_PRO_TIER3 = 'price_pro_t3';
    expect(getPriceForTier('pro', 3)).toBe('price_pro_t3');
  });
});
