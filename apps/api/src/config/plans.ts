interface Plan {
  price: number;
  monthlyRequests: number;
  stripePriceId: string;
}

function buildPlans(): Record<string, Plan> {
  const seed = process.env.STRIPE_PRICE_SEED;
  const craft = process.env.STRIPE_PRICE_CRAFT;
  const forge = process.env.STRIPE_PRICE_FORGE;

  if (!seed || !craft || !forge) {
    throw new Error(
      `Missing Stripe price env vars: ${[
        !seed && 'STRIPE_PRICE_SEED',
        !craft && 'STRIPE_PRICE_CRAFT',
        !forge && 'STRIPE_PRICE_FORGE',
      ]
        .filter(Boolean)
        .join(', ')}`
    );
  }

  return {
    seed: { price: 9, monthlyRequests: 200, stripePriceId: seed },
    craft: { price: 19, monthlyRequests: 800, stripePriceId: craft },
    forge: { price: 39, monthlyRequests: 3000, stripePriceId: forge },
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
    if (plan.stripePriceId === priceId) {
      return planName;
    }
  }
  return null;
}
