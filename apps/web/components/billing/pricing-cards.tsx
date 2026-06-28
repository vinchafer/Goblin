"use client";

import { Check } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { buildsPerMonth } from "@/lib/plan-builds";
import { storageLabelCloud } from "@/lib/plan-storage";

// HR-6: Goblin allowance shown as the honest "≈ N Builds / month" proxy, not the
// retired "N monthly requests" metric. BYOK carries no Goblin limit (HR-3).
const PLANS = {
  build: {
    name: "Build",
    price: 11,
    features: [
      buildsPerMonth('build', 'en'),
      "Unlimited projects",
      "BYOK — all providers, no Goblin limits",
      storageLabelCloud('build', 'en'),
      "GitHub push integration",
      "Community support"
    ]
  },
  pro: {
    name: "Pro",
    price: 19,
    features: [
      buildsPerMonth('pro', 'en'),
      "Unlimited projects",
      "BYOK — all providers, no Goblin limits",
      storageLabelCloud('pro', 'en'),
      "GitHub push integration",
      "Priority support"
    ]
  },
  power: {
    name: "Power",
    price: 39,
    features: [
      buildsPerMonth('power', 'en'),
      "Unlimited projects",
      "BYOK — all providers, no Goblin limits",
      storageLabelCloud('power', 'en'),
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

  // Checkout now runs through the Elements/SetupIntent flow on the upgrade page
  // (card BIN → authoritative price). Route there instead of the retired hosted
  // checkout. (This component is currently unreferenced; kept import-safe.)
  const handleUpgrade = async (planId: string) => {
    if (!showUpgrade) {
      window.location.href = `/login?plan=${planId}`;
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return;
    window.location.href = `/dashboard/upgrade?plan=${planId}`;
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
