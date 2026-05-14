interface Plan {
  price: number;
  monthlyRequests: number;
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
      monthlyRequests: 200,
      stripePriceId: build,
      stripePriceIdTier2: process.env.STRIPE_PRICE_BUILD_TIER2,
      stripePriceIdTier3: process.env.STRIPE_PRICE_BUILD_TIER3,
    },
    pro: {
      price: 19,
      monthlyRequests: 800,
      stripePriceId: pro,
      stripePriceIdTier2: process.env.STRIPE_PRICE_PRO_TIER2,
      stripePriceIdTier3: process.env.STRIPE_PRICE_PRO_TIER3,
    },
    power: {
      price: 39,
      monthlyRequests: 3000,
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
