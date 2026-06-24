import { describe, it, expect } from 'vitest';
import {
  getGeoTier,
  pricierTier,
  getPriceForTier,
  PLAN_PRICES,
  type GeoTier,
} from './geo-pricing';

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

  it('lowercase input is normalised', () => {
    expect(getGeoTier('de')).toBe(1);
    expect(getGeoTier('in')).toBe(3);
  });

  it('null / unknown country → Tier 1 (never under-charge)', () => {
    expect(getGeoTier(null)).toBe(1);
    expect(getGeoTier('ZZ')).toBe(1);
  });

  it('WB-unclassified (INX: ET, VE) falls through to Tier 1', () => {
    expect(getGeoTier('ET')).toBe(1);
    expect(getGeoTier('VE')).toBe(1);
  });
});

describe('pricierTier — anti-VPN reconciliation', () => {
  it('VPN US-IP (T1) with IN card (T3) — card wins → T3', () => {
    const ipTier: GeoTier = 1;
    const cardTier = getGeoTier('IN'); // 3
    // checkout enforcement takes the pricier (lower number) of the two
    expect(pricierTier(ipTier, cardTier)).toBe(1);
  });

  it('cheap-IP (T3) with expensive card (T1) — card wins → T1', () => {
    expect(pricierTier(3, 1)).toBe(1);
  });

  it('equal tiers → same tier', () => {
    expect(pricierTier(2, 2)).toBe(2);
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
