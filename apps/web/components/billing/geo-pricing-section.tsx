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
    '200 AI requests / month',
    '10 projects',
    'BYOK — all AI providers',
    '5 GB cloud storage',
    'GitHub push integration',
    'Build from any device',
  ],
  pro: [
    '800 AI requests / month',
    '50 projects',
    'BYOK — all AI providers',
    '20 GB cloud storage',
    'GitHub push integration',
    'Build from any device',
  ],
  power: [
    '3,000 AI requests / month',
    'Unlimited projects',
    'BYOK — all AI providers',
    '100 GB cloud storage',
    'GitHub push integration',
    'Build from any device',
    'Beta features access',
  ],
};

const DEFAULT_PRICES = { build: 9, pro: 19, power: 39 };

const PLAN_META = {
  build: { label: 'Build', tagline: 'Start free, ship fast.' },
  pro: { label: 'Pro', tagline: 'For shipping serious projects.' },
  power: { label: 'Power', tagline: 'For builders who never stop.' },
} as const;

export function GeoPricingSection() {
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiBase}/api/billing/geo-pricing`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GeoData | null) => {
        if (d?.prices) setPrices(d.prices);
      })
      .catch(() => {});
  }, []);

  return (
    <section
      id="pricing"
      style={{
        background: 'var(--paper)',
        padding: '120px 32px',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64, maxWidth: 660, marginLeft: 'auto', marginRight: 'auto' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#1F3A1D', color: '#F0CF8A',
              padding: '6px 14px', borderRadius: 100,
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 22, fontFamily: 'var(--font-sans)',
              boxShadow: '0 4px 12px -4px rgba(31,58,29,0.40)',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0CF8A' }} />
            Pricing
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(36px, 4.8vw, 58px)',
              color: '#0F2A0D',
              letterSpacing: '-0.025em',
              fontWeight: 700,
              margin: '0 0 16px',
              lineHeight: 1.05,
            }}
          >
            Simple pricing.{' '}
            <em style={{ fontStyle: 'italic', color: '#7A5A12', fontWeight: 700 }}>
              Build anywhere.
            </em>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: '#1F3A1D',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.6,
              margin: 0,
              fontWeight: 500,
            }}
          >
            3-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        <div
          className="pricing-grid"
          style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'center', alignItems: 'stretch',
            gap: 20,
          }}
        >
          {(['build', 'pro', 'power'] as const).map((planId) => {
            const price = prices[planId];
            const features = PLAN_FEATURES[planId];
            const meta = PLAN_META[planId];
            const recommended = planId === 'pro';

            return (
              <div
                key={planId}
                style={{
                  flex: '1 1 280px',
                  minWidth: 280, maxWidth: 340,
                  background: recommended ? '#1f3a1d' : '#fff',
                  color: recommended ? 'var(--paper)' : '#1a2e18',
                  border: recommended
                    ? '1px solid rgba(212,167,55,0.45)'
                    : '1px solid rgba(45,74,43,0.14)',
                  borderRadius: 18,
                  padding: '34px 28px 30px',
                  display: 'flex', flexDirection: 'column',
                  position: 'relative',
                  boxShadow: recommended
                    ? '0 1px 0 rgba(255,255,255,0.08) inset, 0 36px 70px -28px rgba(31,58,29,0.55)'
                    : '0 1px 0 rgba(255,255,255,0.9) inset, 0 22px 44px -24px rgba(45,74,43,0.22)',
                  transform: recommended ? 'translateY(-6px)' : 'none',
                }}
              >
                {recommended && (
                  <div
                    style={{
                      position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                      background: 'var(--brand-gold)',
                      color: '#1a2018',
                      fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '4px 10px', borderRadius: 100,
                      fontFamily: 'var(--font-sans)',
                      boxShadow: '0 4px 12px rgba(212,167,55,0.45)',
                    }}
                  >
                    Recommended
                  </div>
                )}

                <h3
                  style={{
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: recommended ? '#F0CF8A' : '#7A5A12',
                    marginBottom: 10,
                    fontFamily: 'var(--font-sans)',
                    margin: '0 0 10px',
                  }}
                >
                  {meta.label}
                </h3>

                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 17, fontWeight: 600, fontStyle: 'italic',
                    color: recommended ? '#F5DC95' : '#1F3A1D',
                    marginBottom: 20,
                    lineHeight: 1.4,
                  }}
                >
                  {meta.tagline}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 52, fontWeight: 600,
                      color: recommended ? 'var(--paper)' : '#1a2e18',
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                    }}
                  >
                    ${price}
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      color: recommended ? 'var(--gold-300)' : '#1F3A1D',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                    }}
                  >
                    /month
                  </span>
                </div>

                <ul
                  style={{
                    listStyle: 'none', padding: 0, margin: '0 0 28px',
                    display: 'flex', flexDirection: 'column', gap: 11, flex: 1,
                  }}
                >
                  {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span
                        style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: recommended ? 'var(--gold-300)' : '#1f3a1d',
                          color: recommended ? '#1a2018' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 1,
                        }}
                      >
                        <Check style={{ width: 10, height: 10 }} strokeWidth={3} />
                      </span>
                      <span
                        style={{
                          fontSize: 13.5,
                          color: recommended ? 'var(--paper)' : '#1f3a1d',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 500,
                          lineHeight: 1.55,
                        }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/login?plan=${planId}`}
                  style={{
                    display: 'block', width: '100%',
                    padding: '14px 0', borderRadius: 10,
                    textAlign: 'center', fontSize: 'var(--t-small-fs)', fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-sans)',
                    background: recommended ? 'var(--gold-300)' : '#1f3a1d',
                    color: recommended ? '#1a2018' : '#fff',
                    boxShadow: recommended
                      ? '0 1px 0 rgba(255,255,255,0.35) inset, 0 8px 22px rgba(232,191,106,0.45)'
                      : '0 1px 0 rgba(255,255,255,0.10) inset, 0 6px 18px rgba(31,58,29,0.30)',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  Start free trial
                </Link>
              </div>
            );
          })}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12.5,
            color: '#4a6045',
            fontFamily: 'var(--font-sans)',
            marginTop: 32, lineHeight: 1.7,
            fontWeight: 500,
          }}
        >
          BYOK users bring their own API keys. Goblin charges $0 extra for inference.
          {' '}Secure checkout via Stripe.
        </p>
      </div>
    </section>
  );
}
