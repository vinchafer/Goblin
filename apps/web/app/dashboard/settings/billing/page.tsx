import { createClient } from "@/lib/supabase/server";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { UsageDisplay } from "@/components/billing/usage-display";
import { PricingCards } from "@/components/billing/pricing-cards";

export default async function BillingSettingsPage() {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('plan, monthly_requests_used, monthly_limit, stripe_subscription_id, subscription_current_period_end')
    .eq('id', user.user?.id)
    .single();

  const hasSubscription = !!userData?.stripe_subscription_id;
  const currentPlan = userData?.plan || 'seed';
  const used = userData?.monthly_requests_used || 0;
  const limit = userData?.monthly_limit || 200;
  const resetDate = userData?.subscription_current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const handleUpgrade = async (targetPlan: string) => {
    'use server';

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ targetPlan })
    });

    const data = await response.json();
    return data.checkoutUrl;
  };

  return (
    <SettingsLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--goblin-slate)' }}>
          Billing & Plan
        </h1>

        <UsageDisplay used={used} limit={limit} resetDate={resetDate} />

        {hasSubscription && (
          <div className="mb-8 p-4 rounded-lg flex items-center justify-between" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div style={{ color: 'var(--goblin-slate)' }}>
              <span className="font-medium">Subscribed</span> to {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan
            </div>
            <form action={`${process.env.NEXT_PUBLIC_API_URL}/api/billing/create-portal-session`} method="POST">
              <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--goblin-slate)', color: 'white' }}>
                Manage Subscription
              </button>
            </form>
          </div>
        )}

        <PricingCards currentPlan={currentPlan} onUpgrade={handleUpgrade} />
      </div>
    </SettingsLayout>
  );
}