/**
 * Geo-Pricing Tier Classification (Strategy V1)
 * Tier 1: $9/$19/$39 — USA, EU, UK, AU, CA, JP, SG, CH, NO
 * Tier 2: $4/$9/$19  — Latam, Eastern Europe, Turkey, South Africa, SE Asia
 * Tier 3: $3/$6/$12  — India, Pakistan, Bangladesh, Nigeria, Kenya, Sub-Sahara
 */

export type GeoTier = 1 | 2 | 3;

const TIER_1_COUNTRIES = new Set([
  'US', 'GB', 'DE', 'FR', 'NL', 'SE', 'DK', 'NO', 'FI', 'AT', 'BE',
  'CH', 'LU', 'IE', 'ES', 'PT', 'IT', 'AU', 'NZ', 'CA', 'JP', 'SG',
  'HK', 'KR', 'TW', 'IL', 'AE',
]);

const TIER_3_COUNTRIES = new Set([
  'IN', 'PK', 'BD', 'NG', 'KE', 'ET', 'TZ', 'UG', 'GH', 'CI',
  'CM', 'SN', 'MG', 'MZ', 'ZM', 'ZW', 'RW', 'SD', 'SO', 'ML',
  'NE', 'TD', 'BF', 'MR', 'SL', 'LR', 'GM',
]);

export function getGeoTier(countryCode: string | null): GeoTier {
  if (!countryCode) return 1;
  const code = countryCode.toUpperCase();
  if (TIER_1_COUNTRIES.has(code)) return 1;
  if (TIER_3_COUNTRIES.has(code)) return 3;
  return 2;
}

export function getPriceForTier(plan: string, tier: GeoTier): string | undefined {
  const prices: Record<string, Record<GeoTier, string | undefined>> = {
    build: {
      1: process.env.STRIPE_PRICE_BUILD_TIER1,
      2: process.env.STRIPE_PRICE_BUILD_TIER2,
      3: process.env.STRIPE_PRICE_BUILD_TIER3,
    },
    pro: {
      1: process.env.STRIPE_PRICE_PRO_TIER1,
      2: process.env.STRIPE_PRICE_PRO_TIER2,
      3: process.env.STRIPE_PRICE_PRO_TIER3,
    },
    power: {
      1: process.env.STRIPE_PRICE_POWER_TIER1,
      2: process.env.STRIPE_PRICE_POWER_TIER2,
      3: process.env.STRIPE_PRICE_POWER_TIER3,
    },
  };

  // Fall back to Tier 1 if tier price not configured
  return prices[plan]?.[tier] ?? prices[plan]?.[1];
}

export type PlanName = 'build' | 'pro' | 'power';

export const PLAN_PRICES: Record<PlanName, Record<GeoTier, number>> = {
  build: { 1: 9,  2: 4, 3: 3  },
  pro:   { 1: 19, 2: 9, 3: 6  },
  power: { 1: 39, 2: 19, 3: 12 },
};

export const TIER_LABELS: Record<GeoTier, string> = {
  1: 'Standard',
  2: 'Latam / Eastern Europe',
  3: 'India / Africa',
};
