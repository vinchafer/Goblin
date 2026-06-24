'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PLAN_BUILDS } from '@/lib/plan-builds';
import { CheckoutPanel } from '@/components/billing/CheckoutPanel';

type PlanId = 'build' | 'pro' | 'power';

// HR-6: the per-plan figure is the Builds proxy (apps/web/lib/plan-builds.ts), not
// the retired request count.
const PLAN_INFO: Record<string, { label: string; price: number; builds: number; color: string }> = {
  build: { label: 'Build', price: 11, builds: PLAN_BUILDS.build, color: '#8B6914' },
  pro:   { label: 'Pro',   price: 19, builds: PLAN_BUILDS.pro,   color: 'var(--brand-green)' },
  power: { label: 'Power', price: 39, builds: PLAN_BUILDS.power, color: '#1a2d5a' },
};

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string | null;
  pdf_url: string | null;
  hosted_url: string | null;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface UsageData {
  plan: string;
  used: number;
  reset_date: string | null;
  breakdown: { byok: number; free_api: number; goblin_hosted: number };
}

const CARD_STYLE = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '24px 28px',
  marginBottom: 20,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function BillingDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [geoPrices, setGeoPrices] = useState<Record<PlanId, number> | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setToken(session.access_token);

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [usageRes, invoicesRes, pmRes] = await Promise.all([
        fetch(`${apiBase}/api/billing/usage`, { headers }),
        fetch(`${apiBase}/api/billing/invoices`, { headers }),
        fetch(`${apiBase}/api/billing/payment-method`, { headers }),
      ]);

      if (usageRes.ok) setUsage(await usageRes.json());
      if (invoicesRes.ok) {
        const d = await invoicesRes.json();
        setInvoices(d.invoices ?? []);
      }
      if (pmRes.ok) {
        const d = await pmRes.json();
        setPaymentMethod(d.payment_method);
      }
      // IP-based display prices (the charge is BIN-resolved in the panel).
      try {
        const gp = await fetch(`${apiBase}/api/billing/geo-pricing`);
        if (gp.ok) {
          const d = await gp.json();
          if (d?.prices) setGeoPrices(d.prices as Record<PlanId, number>);
        }
      } catch { /* fall back to static prices */ }
      setLoading(false);
    };
    init();
  }, [apiBase]);

  const handlePortal = async () => {
    if (!token) return;
    setPortalLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.portalUrl) window.location.href = d.portalUrl;
    } finally {
      setPortalLoading(false);
    }
  };

  const priceFor = (id: string): number =>
    geoPrices?.[id as PlanId] ?? PLAN_INFO[id]?.price ?? 0;

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...CARD_STYLE, height: 120, background: 'var(--subtle)', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  // Never fabricate a paid plan: if /usage didn't return one, show a neutral
  // "no active plan" state rather than a phantom Build.
  const plan = usage?.plan ?? null;
  const planInfo = plan ? (PLAN_INFO[plan] ?? null) : null;
  // DD §A: a plain BUILD count this month. The only cap is the weighted Goblin
  // allowance, surfaced on the dedicated usage screen — not as a request percent here.
  const buildsThisMonth = usage?.used ?? 0;

  const UPGRADE_PLANS = Object.entries(PLAN_INFO).filter(([k]) => k !== plan);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 28 }}>
        Billing & Plan
      </h1>

      {/* Current Plan */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              {planInfo ? (
                <>
                  <span style={{
                    fontSize: 'var(--t-caption-fs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: planInfo.color, color: '#fff', padding: '2px 8px', borderRadius: 4,
                  }}>{planInfo.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
                    ${priceFor(plan!)}/month
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
                  No active plan
                </span>
              )}
            </div>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.3px' }}>
              Current Plan
            </h2>
            {usage?.reset_date && (
              <p style={{ fontSize: 13, color: 'var(--meta)', marginTop: 4 }}>
                Renews {formatDate(usage.reset_date)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              style={{
                background: 'transparent', color: 'var(--brand-green)',
                border: '1.5px solid var(--brand-green)', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 500,
                cursor: portalLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)', opacity: portalLoading ? 0.6 : 1,
              }}
            >
              {portalLoading ? 'Loading…' : 'Manage Subscription'}
            </button>
            {UPGRADE_PLANS.map(([key, info]) => (
              <button
                key={key}
                onClick={() => setCheckoutPlan(key as PlanId)}
                disabled={!!checkoutPlan}
                style={{
                  background: 'var(--brand-gold)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  cursor: checkoutPlan ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)', opacity: checkoutPlan === key ? 0.6 : 1,
                }}
              >
                {`Upgrade to ${info.label}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Usage */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Usage This Month
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>
          {buildsThisMonth} {buildsThisMonth === 1 ? 'build' : 'builds'} this month
          {usage?.reset_date ? ` · resets ${formatDate(usage.reset_date)}` : ''}
        </p>

        {/* Breakdown */}
        {usage && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'BYOK', value: usage.breakdown.byok, desc: 'Your API keys' },
              { label: 'Free Pool', value: usage.breakdown.free_api, desc: 'Goblin free tier' },
              { label: 'Goblin', value: usage.breakdown.goblin_hosted, desc: 'Goblin-bundled models' },
            ].map(item => (
              <div key={item.label} style={{
                background: 'var(--subtle)', borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--text-2)', marginTop: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 1 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>
              Payment Method
            </h2>
            {paymentMethod ? (
              <p style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
                {capitalize(paymentMethod.brand)} ···· {paymentMethod.last4} &nbsp;·&nbsp; Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--meta)' }}>No payment method on file.</p>
            )}
          </div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            style={{
              background: 'transparent', color: 'var(--meta)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Update Payment Method
          </button>
        </div>
      </div>

      {/* Invoice History */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Billing History
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Last 12 invoices</p>

        {invoices.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--meta)', fontStyle: 'italic' }}>No invoices yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {invoices.map((inv, i) => (
              <div key={inv.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: i < invoices.length - 1 ? '1px solid var(--div)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                    {formatDate(inv.date)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 60, textAlign: 'right' }}>
                  ${(inv.amount ?? 0).toFixed(2)}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '2px 8px', borderRadius: 4,
                  background: inv.status === 'paid' ? 'rgba(74,124,59,0.12)' : 'rgba(184,92,60,0.12)',
                  color: inv.status === 'paid' ? 'var(--success)' : 'var(--danger)',
                }}>
                  {inv.status ?? 'unknown'}
                </div>
                {inv.pdf_url && (
                  <a
                    href={inv.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--brand-green)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    PDF ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {checkoutPlan && (
        <CheckoutPanel
          plan={checkoutPlan}
          planName={PLAN_INFO[checkoutPlan]?.label ?? capitalize(checkoutPlan)}
          displayPrice={priceFor(checkoutPlan)}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => { window.location.href = '/dashboard/settings/billing/success'; }}
        />
      )}
    </div>
  );
}
