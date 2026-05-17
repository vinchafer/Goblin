'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check } from '@phosphor-icons/react';

type GeoTier = 1 | 2 | 3;

interface GeoData {
  tier: GeoTier;
  country: string | null;
  prices: { build: number; pro: number; power: number };
}

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

const DEFAULT_PRICES = { build: 9, pro: 19, power: 39 };

export function GeoPricingSection() {
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiBase}/api/billing/geo-pricing`)
      .then(r => r.ok ? r.json() : null)
      .then((d: GeoData | null) => { if (d?.prices) setPrices(d.prices); })
      .catch(() => {});
  }, []);

  return (
    <section id="pricing" style={{ background: 'var(--cream2)', padding: '80px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ochre)', marginBottom: 12, fontFamily: 'DM Sans, sans-serif' }}>
            Pricing
          </div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 4vw, 42px)', color: 'var(--moss)', letterSpacing: '-1.2px', fontWeight: 700, marginBottom: 12 }}>
            Simple pricing. Build anywhere.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
            3-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {(['build', 'pro', 'power'] as const).map((planId) => {
            const price = prices[planId];
            const features = PLAN_FEATURES[planId];

            return (
              <div key={planId} style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 16, padding: '28px 24px 24px',
                display: 'flex', flexDirection: 'column',
              }}>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--bark)', marginBottom: 8 }}>
                  {planId.charAt(0).toUpperCase() + planId.slice(1)}
                </h3>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: 40, fontWeight: 700, color: 'var(--text)' }}>
                    ${price}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>/month</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
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
                  background: 'transparent',
                  color: 'var(--moss)',
                  border: '1.5px solid var(--moss)',
                }}>
                  Start free trial
                </Link>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', marginTop: 24, lineHeight: 1.7 }}>
          BYOK users bring their own API keys. Goblin charges $0 extra for inference.
          {' '}Secure checkout via Stripe.
        </p>
      </div>
    </section>
  );
}
