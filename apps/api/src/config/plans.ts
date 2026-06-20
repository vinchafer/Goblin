interface Plan {
  price: number;
  // DD §A: the legacy per-plan request-count (`monthlyRequests`) is retired. The only
  // limit is the weighted Goblin allowance (lib/goblin-cap.ts GOBLIN_MONTHLY_ALLOWANCE),
  // keyed off `plan`. This config now carries only price + Stripe price ids.
  stripePriceId: string;        // Tier 1 (default, used for checkout)
  stripePriceIdTier2?: string;  // Geo-pricing Tier 2 (Phase Z5)
  stripePriceIdTier3?: string;  // Geo-pricing Tier 3 (Phase Z5)
}

function buildPlans(): Record<string, Plan> {
  const build = process.env.STRIPE_PRICE_BUILD_TIER1;
  const pro   = process.env.STRIPE_PRICE_PRO_TIER1;
  const power = process.env.STRIPE_PRICE_POWER_TIER1;

  if (!build || !pro || !power) {
    throw new Error(
      `Missing Stripe price env vars: ${[
        !build && 'STRIPE_PRICE_BUILD_TIER1',
        !pro   && 'STRIPE_PRICE_PRO_TIER1',
        !power && 'STRIPE_PRICE_POWER_TIER1',
      ]
        .filter(Boolean)
        .join(', ')}`
    );
  }

  return {
    build: {
      price: 9,
      stripePriceId: build,
      stripePriceIdTier2: process.env.STRIPE_PRICE_BUILD_TIER2,
      stripePriceIdTier3: process.env.STRIPE_PRICE_BUILD_TIER3,
    },
    pro: {
      price: 19,
      stripePriceId: pro,
      stripePriceIdTier2: process.env.STRIPE_PRICE_PRO_TIER2,
      stripePriceIdTier3: process.env.STRIPE_PRICE_PRO_TIER3,
    },
    power: {
      price: 39,
      stripePriceId: power,
      stripePriceIdTier2: process.env.STRIPE_PRICE_POWER_TIER2,
      stripePriceIdTier3: process.env.STRIPE_PRICE_POWER_TIER3,
    },
  };
}

let _plans: Record<string, Plan> | null = null;

export function getPlans(): Record<string, Plan> {
  if (!_plans) {
    _plans = buildPlans();
  }
  return _plans;
}

export function getPlanFromPriceId(priceId: string): string | null {
  const plans = getPlans();
  for (const [planName, plan] of Object.entries(plans)) {
    if (
      plan.stripePriceId === priceId ||
      plan.stripePriceIdTier2 === priceId ||
      plan.stripePriceIdTier3 === priceId
    ) {
      return planName;
    }
  }
  return null;
}
