interface Plan {
  price: number;
  monthlyRequests: number;
  stripePriceId: string;
}

export const PLANS: Record<string, Plan> = {
  seed: {
    price: 9,
    monthlyRequests: 200,
    stripePriceId: process.env.STRIPE_PRICE_SEED!
  },
  craft: {
    price: 19,
    monthlyRequests: 800,
    stripePriceId: process.env.STRIPE_PRICE_CRAFT!
  },
  forge: {
    price: 39,
    monthlyRequests: 3000,
    stripePriceId: process.env.STRIPE_PRICE_FORGE!
  }
};

export function getPlanFromPriceId(priceId: string): string | null {
  for (const [planName, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceId === priceId) {
      return planName;
    }
  }
  return null;
}