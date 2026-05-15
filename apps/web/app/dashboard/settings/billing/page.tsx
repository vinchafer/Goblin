import { createClient } from "@/lib/supabase/server";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { UsageDisplay } from "@/components/billing/usage-display";

export const dynamic = 'force-dynamic';
import { PricingCards } from "@/components/billing/pricing-cards";

export default async function BillingSettingsPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.user?.id ?? '')
    .single() as unknown as { data: { plan: string; monthly_requests_used: number; monthly_limit: number; stripe_subscription_id: string | null; subscription_current_period_end: string | null } | null };

  const hasSubscription = !!userData?.stripe_subscription_id;
  const currentPlan = userData?.plan || 'build';
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
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--moss)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          Billing & Plan
        </h1>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 28, fontFamily: 'DM Sans, sans-serif' }}>
          Manage your subscription, usage, and payment methods.
        </p>

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