/**
 * Geo-Pricing Tier Classification (Strategy V2 — regional re-wire 2026-06-23)
 * Tier 1 (High income):          Build $11 · Pro $19 · Power $39
 * Tier 2 (Upper-middle income):  Build $7  · Pro $12 · Power $25
 * Tier 3 (Lower-middle + Low):   Build $4  · Pro $7  · Power $14
 *
 * Country→tier resolution is World-Bank income-classification based
 * (see WB_INCOME_TIER below). PLAN_PRICES here is the single source of
 * truth for the DISPLAYED amount; checkout charges the matching Stripe
 * price-ID env var (STRIPE_PRICE_<PLAN>_TIER<n>), kept in lockstep.
 */

export type GeoTier = 1 | 2 | 3;

/**
 * Country → tier map, derived from the World Bank income classification.
 * Source: World Bank API v2 — https://api.worldbank.org/v2/country
 * Fiscal year: FY2025 (2023 GNI, Atlas method; updated each July 1).
 * Fetched 2026-06-23.
 *
 * Mapping rule (WB 4-group → our 3 tiers):
 *   High income (HIC)         → Tier 1
 *   Upper-middle income (UMC) → Tier 2
 *   Lower-middle income (LMC) → Tier 3
 *   Low income (LIC)          → Tier 3
 *
 * Keys are ISO-3166 alpha-2 (uppercase). WB-unclassified economies (INX,
 * currently ET + VE) are not in this table — they are assigned explicit
 * founder-confirmed overrides below (VE→T2, ET→T3) that restore what the
 * income rule would otherwise assign. Refresh annually.
 */
const WB_INCOME_TIER: Record<string, GeoTier> = {
  AD: 1, AE: 1, AF: 3, AG: 1, AL: 2, AM: 2, AO: 3, AR: 2, AS: 1, AT: 1, AU: 1, AW: 1, AZ: 2,
  BA: 2, BB: 1, BD: 3, BE: 1, BF: 3, BG: 1, BH: 1, BI: 3, BJ: 3, BM: 1, BN: 1, BO: 3, BR: 2,
  BS: 1, BT: 3, BW: 2, BY: 2, BZ: 2, CA: 1, CD: 3, CF: 3, CG: 3, CH: 1, CI: 3, CL: 1, CM: 3,
  CN: 2, CO: 2, CR: 1, CU: 2, CV: 2, CW: 1, CY: 1, CZ: 1, DE: 1, DJ: 3, DK: 1, DM: 2, DO: 2,
  DZ: 2, EC: 2, EE: 1, EG: 3, ER: 3, ES: 1, FI: 1, FJ: 2, FM: 3, FO: 1, FR: 1, GA: 2, GB: 1,
  GD: 2, GE: 2, GH: 3, GI: 1, GL: 1, GM: 3, GN: 3, GQ: 2, GR: 1, GT: 2, GU: 1, GW: 3, GY: 1,
  HK: 1, HN: 3, HR: 1, HT: 3, HU: 1, ID: 2, IE: 1, IL: 1, IM: 1, IN: 3, IQ: 2, IR: 2, IS: 1,
  IT: 1, JG: 1, JM: 2, JO: 3, JP: 1, KE: 3, KG: 3, KH: 3, KI: 3, KM: 3, KN: 1, KP: 3, KR: 1,
  KW: 1, KY: 1, KZ: 2, LA: 3, LB: 3, LC: 2, LI: 1, LK: 3, LR: 3, LS: 3, LT: 1, LU: 1, LV: 1,
  LY: 2, MA: 3, MC: 1, MD: 2, ME: 2, MF: 1, MG: 3, MH: 2, MK: 2, ML: 3, MM: 3, MN: 2, MO: 1,
  MP: 1, MR: 3, MT: 1, MU: 2, MV: 2, MW: 3, MX: 2, MY: 2, MZ: 3, NA: 3, NC: 1, NE: 3, NG: 3,
  NI: 3, NL: 1, NO: 1, NP: 3, NR: 1, NZ: 1, OM: 1, PA: 1, PE: 2, PF: 1, PG: 3, PH: 3, PK: 3,
  PL: 1, PR: 1, PS: 3, PT: 1, PW: 1, PY: 2, QA: 1, RO: 1, RS: 2, RU: 1, RW: 3, SA: 1, SB: 3,
  SC: 1, SD: 3, SE: 1, SG: 1, SI: 1, SK: 1, SL: 3, SM: 1, SN: 3, SO: 3, SR: 2, SS: 3, ST: 3,
  SV: 2, SX: 1, SY: 3, SZ: 3, TC: 1, TD: 3, TG: 3, TH: 2, TJ: 3, TL: 3, TM: 2, TN: 3, TO: 2,
  TR: 2, TT: 1, TV: 2, TZ: 3, UA: 2, UG: 3, US: 1, UY: 1, UZ: 3, VC: 2, VG: 1, VI: 1, VN: 3,
  VU: 3, WS: 2, XK: 2, YE: 3, ZA: 2, ZM: 3, ZW: 3,
};

/**
 * Manual overrides (founder-confirmed).
 *   TW — excluded from the WB list for political reasons, high-income → Tier 1.
 *   VE — WB-unclassified (INX); was upper-middle pre-2021 → Tier 2.
 *   ET — WB-unclassified (INX); is a low-income economy → Tier 3.
 * Without VE/ET here they would fall to the unknown→Tier 1 default.
 */
const TIER_OVERRIDES: Record<string, GeoTier> = {
  TW: 1,
  VE: 2,
  ET: 3,
};

export function getGeoTier(countryCode: string | null): GeoTier {
  if (!countryCode) return 1; // unknown → Tier 1 (never under-charge)
  const code = countryCode.toUpperCase();
  return TIER_OVERRIDES[code] ?? WB_INCOME_TIER[code] ?? 1;
}

/**
 * Anti-VPN enforcement (founder decision 2026-06-23: CARD COUNTRY WINS).
 * The payment-method's country is authoritative — it is the real economic
 * signal and far harder to spoof than an IP. The IP-derived (displayed) tier
 * is only a fallback for when no card country is known yet.
 *
 *   card country known   → tier of the card country (cheaper OR pricier).
 *   card country unknown → the IP-derived tier (itself Tier 1 if IP unknown).
 *
 * This defeats the VPN-to-cheap-region vector: a user on a cheap-country IP
 * paying with an expensive-country card is charged the expensive-country tier,
 * while a genuine cheap-country cardholder behind an expensive IP still gets
 * their real (cheaper) regional price.
 */
export function authoritativeTier(cardCountry: string | null, ipTier: GeoTier): GeoTier {
  if (cardCountry) return getGeoTier(cardCountry);
  return ipTier;
}

/**
 * Fail-safe charge-tier resolver (Elements rebuild 2026-06-23).
 * The single source of truth for which tier a checkout is CHARGED at, with the
 * founder-mandated ordering:
 *
 *   1. card issuing country (BIN, `paymentMethod.card.country`) — authoritative.
 *   2. only if the card country is unreadable → the IP-derived tier.
 *   3. last resort (no card, no IP) → Tier 1 (standard, never cheaper).
 *
 * A cheaper-than-displayed tier is therefore only ever reached on POSITIVE
 * card-issuing-country confirmation (case 1). Any uncertainty resolves UP toward
 * Tier 1 — there is no path that grants a discount without a confirmed card
 * country. `getGeoTier(null)` already returns Tier 1, so an unknown IP collapses
 * case 2 into case 3 automatically.
 */
export function resolveChargeTier(
  cardCountry: string | null,
  ipCountry: string | null,
): GeoTier {
  if (cardCountry) return getGeoTier(cardCountry); // case 1 — authoritative
  return getGeoTier(ipCountry);                    // case 2 → (null) collapses to case 3 = T1
}

/** Display/charged dollar amount for a plan at a tier (single source of truth). */
export function tierAmount(plan: PlanName, tier: GeoTier): number {
  return PLAN_PRICES[plan][tier];
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
  build: { 1: 11, 2: 7,  3: 4  },
  pro:   { 1: 19, 2: 12, 3: 7  },
  power: { 1: 39, 2: 25, 3: 14 },
};

export const TIER_LABELS: Record<GeoTier, string> = {
  1: 'Standard',
  2: 'Regional',
  3: 'Regional',
};
