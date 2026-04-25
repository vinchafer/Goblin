"use client";

import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PLANS = {
  seed: {
    name: 'Seed',
    price: 9,
    monthlyRequests: 200,
    features: [
      '200 monthly requests',
      'Unlimited projects',
      'GitHub push integration',
      'Community support'
    ]
  },
  craft: {
    name: 'Craft',
    price: 19,
    monthlyRequests: 800,
    features: [
      '800 monthly requests',
      'Unlimited projects',
      'GitHub push integration',
      'Priority support',
      'Priority model access'
    ]
  },
  forge: {
    name: 'Forge',
    price: 39,
    monthlyRequests: 3000,
    features: [
      '3000 monthly requests',
      'Unlimited projects',
      'GitHub push integration',
      'Dedicated support',
      'Beta features access',
      'Custom model fine-tuning'
    ]
  }
};

interface PricingCardsProps {
  currentPlan?: string;
  showUpgrade?: boolean;
  onUpgrade?: (plan: string) => void | Promise<unknown>;
}

export function PricingCards({ currentPlan, showUpgrade = true }: PricingCardsProps) {
  const supabase = createClient();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Object.entries(PLANS).map(([planId, plan]) => {
        const isCurrentPlan = currentPlan === planId;

        return (
          <div
            key={planId}
            className="border rounded-xl p-5 relative"
            style={{ borderColor: isCurrentPlan ? 'var(--goblin-ochre)' : 'var(--goblin-light)' }}
          >
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--goblin-ochre)', color: 'white' }}>
                Current Plan
              </div>
            )}

            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--goblin-moss)' }}>{plan.name}</h3>
            <div className="text-3xl font-bold mb-4" style={{ color: 'var(--goblin-ochre)' }}>${plan.price}<span className="text-sm font-normal" style={{ color: 'var(--goblin-gray)' }}>/month</span></div>

            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--goblin-slate)' }}>
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--goblin-moss)' }} />
                  {feature}
                </li>
              ))}
            </ul>

            {isCurrentPlan ? (
              <button disabled className="w-full py-2.5 rounded-lg text-sm font-medium opacity-50" style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}>
                Current Plan
              </button>
             ) : (
               <button
                 onClick={async () => {
                   if (showUpgrade) {
                     // Dashboard context: call API directly
                     const { data } = await supabase.auth.getSession();
                     const token = data.session?.access_token;
                     
                     if (token) {
                       const response = await fetch('/api/billing/create-checkout-session', {
                         method: 'POST',
                         headers: {
                           'Content-Type': 'application/json',
                           'Authorization': `Bearer ${token}`
                         },
                         body: JSON.stringify({ plan: planId })
                       });
                       
                       if (response.ok) {
                         const result = await response.json();
                         window.location.href = result.url;
                       }
                     }
                   } else {
                     // Landing page context: redirect to login
                     window.location.href = `/login?plan=${planId}`;
                   }
                 }}
                 className="w-full py-2.5 rounded-lg text-sm font-medium"
                 style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
               >
                 {showUpgrade ? 'Upgrade' : 'Get started'}
               </button>
             )}
          </div>
        );
      })}
    </div>
  );
}