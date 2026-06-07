"use client";

import { Check } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

const PLANS = {
  build: {
    name: "Build",
    price: 9,
    features: [
      "200 monthly requests",
      "Unlimited projects",
      "BYOK — all AI providers",
      "5 GB cloud storage",
      "GitHub push integration",
      "Community support"
    ]
  },
  pro: {
    name: "Pro",
    price: 19,
    features: [
      "800 monthly requests",
      "Unlimited projects",
      "BYOK — all AI providers",
      "20 GB cloud storage",
      "GitHub push integration",
      "Priority support"
    ]
  },
  power: {
    name: "Power",
    price: 39,
    features: [
      "3,000 monthly requests",
      "Unlimited projects",
      "BYOK — all AI providers",
      "100 GB cloud storage",
      "GitHub push integration",
      "Priority support",
      "Beta features access"
    ]
  }
} as const;

type PlanId = keyof typeof PLANS;

interface PricingCardsProps {
  currentPlan?: string;
  showUpgrade?: boolean;
  onUpgrade?: (plan: string) => void | Promise<unknown>;
}

export function PricingCards({ currentPlan, showUpgrade = true }: PricingCardsProps) {
  const supabase = createClient();

  const handleUpgrade = async (planId: string) => {
    if (!showUpgrade) {
      window.location.href = `/login?plan=${planId}`;
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const response = await fetch(`${apiBase}/api/billing/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan: planId })
    });
    if (response.ok) {
      const result = await response.json();
      window.location.href = result.url;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {(Object.entries(PLANS) as [PlanId, typeof PLANS[PlanId]][]).map(([planId, plan]) => {
        const isCurrentPlan = currentPlan === planId;
        const isPopular = false;

        return (
          <div
            key={planId}
            className="relative rounded-2xl p-6 flex flex-col"
            style={{
              border: isPopular
                ? "2px solid var(--brand-green)"
                : `1px solid var(--rule-soft)`,
              backgroundColor: "#fff"
            }}
          >
            {/* Popular badge */}
            {isPopular && (
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor: "var(--brand-green)",
                  fontFamily: "var(--font-sans)"
                }}
              >
                Most popular
              </div>
            )}

            {/* Current plan badge */}
            {isCurrentPlan && !isPopular && (
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor: "var(--brand-gold)",
                  fontFamily: "var(--font-sans)"
                }}
              >
                Current Plan
              </div>
            )}

            <h3
              className="font-display font-bold text-xl mb-1"
              style={{ color: "var(--ink-2)" }}
            >
              {plan.name}
            </h3>

            <div className="mb-5">
              <span
                className="font-display font-bold text-4xl"
                style={{ color: isPopular ? "var(--brand-green)" : "var(--ink-2)" }}
              >
                ${plan.price}
              </span>
              <span
                className="text-sm ml-1"
                style={{ color: "var(--ink-3)", fontFamily: "var(--font-sans)" }}
              >
                /month
              </span>
            </div>

            <ul className="space-y-2.5 mb-8 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: "var(--brand-green)" }}
                  >
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: "var(--ink-1)", fontFamily: "var(--font-sans)" }}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {isCurrentPlan ? (
              <button
                disabled
                className="w-full py-3 rounded-xl text-sm font-medium opacity-50 border"
                style={{
                  borderColor: "var(--rule-soft)",
                  color: "var(--ink-3)",
                  fontFamily: "var(--font-sans)"
                }}
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(planId)}
                className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isPopular ? "var(--brand-green)" : "transparent",
                  color: isPopular ? "#fff" : "var(--brand-green)",
                  border: isPopular ? "none" : `1px solid var(--brand-green)`,
                  fontFamily: "var(--font-sans)"
                }}
                onMouseEnter={(e) => {
                  if (isPopular) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--green-600)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (isPopular) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--brand-green)";
                  }
                }}
              >
                {showUpgrade ? "Upgrade" : "Get started"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
