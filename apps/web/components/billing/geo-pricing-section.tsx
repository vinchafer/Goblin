'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

type GeoTier = 1 | 2 | 3;

interface GeoData {
  tier: GeoTier;
  country: string | null;
  label: string;
  prices: { build: number; pro: number; power: number };
}

const TIER_LABELS: Record<GeoTier, string> = {
  1: 'USA / EU / CH',
  2: 'Latam / Eastern Europe',
  3: 'India / Africa',
};

const PLAN_FEATURES = {
  build: [
    '200 AI requests/month',
    '10 projects',
    'BYOK — all AI providers',
    '5 GB cloud storage',
    'GitHub push integration',
    'Build from any device',
  ],
  pro: [
    '800 AI requests/month',
    '50 projects',
    'BYOK — all AI providers',
    '20 GB cloud storage',
    'GitHub push integration',
    'Build from any device',
  ],
  power: [
    '3,000 AI requests/month',
    'Unlimited projects',
    'BYOK — all AI providers',
    '100 GB cloud storage',
    'GitHub push integration',
    'Build from any device',
    'Beta features access',
  ],
};

export function GeoPricingSection() {
  const [geoData, setGeoData] = useState<GeoData>({
    tier: 1,
    country: null,
    label: TIER_LABELS[1],
    prices: { build: 9, pro: 19, power: 39 },
  });
  const [manualTier, setManualTier] = useState<GeoTier | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiBase}/api/billing/geo-pricing`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setGeoData(d); })
      .catch(() => {});
  }, []);

  const activeTier: GeoTier = manualTier ?? geoData.tier;
  const priceMult: Record<GeoTier, { build: number; pro: number; power: number }> = {
    1: { build: 9,  pro: 19, power: 39 },
    2: { build: 4,  pro: 9,  power: 19 },
    3: { build: 3,  pro: 6,  power: 12 },
  };
  const prices = priceMult[activeTier];

  return (
    <section id="pricing" style={{ background: 'var(--cream2)', padding: '80px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ochre)', marginBottom: 12, fontFamily: 'DM Sans, sans-serif' }}>
            Pricing
          </div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 4vw, 42px)', color: 'var(--moss)', letterSpacing: '-1.2px', fontWeight: 700, marginBottom: 12 }}>
            Build anywhere. Pay less where it makes sense.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, marginBottom: 24 }}>
            3-day free trial. No credit card required. Cancel anytime.
          </p>

          {/* Region selector */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
              Showing prices for:
            </span>
            {([1, 2, 3] as GeoTier[]).map(t => (
              <button key={t} onClick={() => setManualTier(manualTier === t ? null : t)}
                style={{
                  padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  background: activeTier === t ? 'var(--moss)' : 'transparent',
                  color: activeTier === t ? '#fff' : 'var(--meta)',
                }}>
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {(['build', 'pro', 'power'] as const).map((planId) => {
            const isPopular = planId === 'pro';
            const price = prices[planId];
            const features = PLAN_FEATURES[planId];

            return (
              <div key={planId} style={{
                background: 'var(--panel)',
                border: isPopular ? '2px solid var(--moss)' : '1px solid var(--border)',
                borderRadius: 16, padding: '28px 24px 24px',
                position: 'relative',
              }}>
                {isPopular && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--moss)', color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '3px 12px', borderRadius: 20, fontFamily: 'DM Sans, sans-serif',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Most popular
                  </div>
                )}

                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--bark)', marginBottom: 8 }}>
                  {planId.charAt(0).toUpperCase() + planId.slice(1)}
                </h3>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: 40, fontWeight: 700, color: isPopular ? 'var(--moss)' : 'var(--text)' }}>
                    ${price}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>/month</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--moss)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Check style={{ width: 10, height: 10, color: '#fff' }} strokeWidth={3} />
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={`/login?plan=${planId}`} style={{
                  display: 'block', width: '100%', padding: '12px 0', borderRadius: 10,
                  textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                  background: isPopular ? 'var(--moss)' : 'transparent',
                  color: isPopular ? '#fff' : 'var(--moss)',
                  border: isPopular ? 'none' : '1.5px solid var(--moss)',
                }}>
                  Start free trial
                </Link>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', marginTop: 24, lineHeight: 1.7 }}>
          Prices shown are for your region. Actual billing uses your card&apos;s country.
          {' '}Goblin-Hosted model limits (3K–Unlimited/month) activate when the service launches.
          {' '}All plans include full BYOK support today.
        </p>
      </div>
    </section>
  );
}
