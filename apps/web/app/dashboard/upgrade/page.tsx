'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { buildsPerMonth, PLAN_BUILDS } from '@/lib/plan-builds';
import { storageLabelCloud, storageGbLabel } from '@/lib/plan-storage';
import { CheckoutPanel } from '@/components/billing/CheckoutPanel';
import { ChangePlanPanel } from '@/components/billing/ChangePlanPanel';

type PlanId = 'build' | 'pro' | 'power';

interface PlanCardData {
  id: PlanId;
  name: string;
  price: number;
  // HR-6: the user-facing allowance proxy in Builds (not the retired request count).
  monthlyBuilds: number;
  meta: string;
  pitch: string;
  features: string[];
  featured?: boolean;   // visual emphasis — the top tier (Power)
}

// Plan names + prices follow code/Stripe reality (recon finding 4):
// Build / Pro / Power, not the proposed Try / Build / Ship rename.
// Per the design decision the design intent still applies — Power reads
// as the user's NEXT step, NOT as a per-seat / Teams plan.
const PLANS: PlanCardData[] = [
  {
    id: 'build',
    name: 'Build',
    price: 11,
    monthlyBuilds: PLAN_BUILDS.build,
    meta: 'FÜR DEN START',
    pitch: 'Lern Goblin kennen. Großzügiges Kontingent für deine Builds, BYOK auf allen Providern — ohne Goblin-Limit.',
    features: [
      buildsPerMonth('build', 'de'),
      'Unbegrenzte Projekte',
      'BYOK — alle Provider, kein Goblin-Limit',
      'Send to Code',
      'GitHub-Push',
      storageLabelCloud('build', 'de'),
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    monthlyBuilds: PLAN_BUILDS.pro,
    meta: 'FÜR REGELMÄSSIGE BUILDER',
    pitch: 'Mehr monatliches Kontingent für regelmäßige Builds.',
    features: [
      buildsPerMonth('pro', 'de'),
      'Unbegrenzte Projekte',
      'BYOK — alle Provider, kein Goblin-Limit',
      storageLabelCloud('pro', 'de'),
      'Send to Code',
      'GitHub-Push',
    ],
  },
  {
    id: 'power',
    name: 'Power',
    price: 39,
    monthlyBuilds: PLAN_BUILDS.power,
    meta: 'WENN DU MEHR KONTINGENT BRAUCHST',
    pitch: 'Mehr Durchsatz für Power-Builder.',
    features: [
      buildsPerMonth('power', 'de'),
      'Unbegrenzte Projekte',
      'BYOK — alle Provider, kein Goblin-Limit',
      storageLabelCloud('power', 'de'),
      'Send to Code',
      'GitHub-Push',
      'Priority Support',
    ],
    featured: true,
  },
];

export default function UpgradePage() {
  const search = useSearchParams();
  const reason = search?.get('reason'); // ?reason=limit-hit emphasises requests
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  // planState 'paid' = active Stripe subscription → plan change goes through the
  // change-plan (subscriptions.update) path, NOT a second create. trial/comped/none
  // → the subscribe path (collect card, create the first subscription).
  const [planState, setPlanState] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);
  // IP-based DISPLAY prices (geo-pricing). Display stays IP-based; the actual
  // charge is resolved from the card BIN inside the Elements panel.
  const [geoPrices, setGeoPrices] = useState<Record<PlanId, number> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/billing/status`, { headers });
        if (r.ok) {
          const data = await r.json();
          setCurrentPlan(data.plan ?? null);
          setPlanState(data.planState ?? null);
        }
      } catch { /* ignore — page still works without current-plan info */ }
    })();
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/billing/geo-pricing`);
        if (r.ok) {
          const d = await r.json();
          if (d?.prices) setGeoPrices(d.prices as Record<PlanId, number>);
        }
      } catch { /* fall back to static Tier-1 prices */ }
    })();
  }, []);

  const priceFor = (p: PlanCardData): number => geoPrices?.[p.id] ?? p.price;

  // If the user got here because of a limit hit, emphasise the allowance in the
  // headline. Otherwise neutral.
  const reasonHeadline = reason === 'limit-hit'
    ? 'Mehr Kontingent pro Monat — wenn du gerade an deine Grenze gestoßen bist.'
    : 'Drei Pläne. BYOK auf jedem. Jederzeit kündbar.';

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '48px 32px 80px' }}>

        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="gobl-eyebrow" style={{ justifyContent: 'center', marginBottom: 18 }}>
            <span className="tick" />
            <span className="num">DEIN PLAN · {(currentPlan ?? '—').toUpperCase()}</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
            fontWeight: 600, fontSize: 'clamp(36px, 4.5vw, 56px)',
            letterSpacing: '-0.034em', lineHeight: 1.04,
            color: 'var(--ink-1)', margin: '0 auto 14px', maxWidth: '16ch',
          }}>
            Mehr bauen, <span className="gobl-serif">weniger ausgeben.</span>
          </h1>
          <p style={{
            fontSize: 16.5, color: 'var(--ink-2)', maxWidth: '56ch',
            margin: '0 auto', lineHeight: 1.5,
          }}>
            {reasonHeadline}
          </p>
        </header>

        {/* Three plan cards lead. Power = featured (top tier, user's next step). */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18, marginBottom: 32,
        }}>
          {PLANS.map(p => {
            const isCurrent = currentPlan === p.id;
            const featured = !!p.featured;
            return (
              <div
                key={p.id}
                style={{
                  background: featured ? 'var(--d-surface-deep)' : 'var(--d-surface-elev)',
                  color: featured ? 'var(--bone)' : 'var(--ink-1)',
                  border: `1px solid ${featured ? 'var(--green)' : 'var(--line)'}`,
                  borderRadius: 'var(--radius-lg)', padding: 28,
                  display: 'flex', flexDirection: 'column', gap: 18, position: 'relative',
                  boxShadow: isCurrent ? '0 0 0 2px var(--accent-rule)' : undefined,
                }}
              >
                {isCurrent && (
                  <span style={{
                    position: 'absolute', top: -10, left: 24,
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    letterSpacing: '0.16em', padding: '4px 9px', borderRadius: 'var(--radius-xs)',
                    background: 'var(--accent-bright)', color: 'var(--green)', fontWeight: 600,
                  }}>
                    DEIN PLAN
                  </span>
                )}
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                    fontWeight: 600, fontSize: 24, letterSpacing: '-0.024em',
                    color: featured ? 'var(--bone)' : 'var(--ink-1)', margin: 0,
                  }}>
                    {p.name}
                  </h3>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: featured ? 'rgba(244,236,216,.62)' : 'var(--ink-3)',
                    display: 'block', marginTop: 6,
                  }}>
                    {p.meta}
                  </span>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 0',
                  borderTop: `1px solid ${featured ? 'rgba(244,236,216,.14)' : 'var(--line)'}`,
                  borderBottom: `1px solid ${featured ? 'rgba(244,236,216,.14)' : 'var(--line)'}`,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                    fontWeight: 600, fontSize: 48, letterSpacing: '-0.036em',
                    color: featured ? 'var(--bone)' : 'var(--ink-1)', lineHeight: 1,
                  }}>
                    ${priceFor(p)}
                  </span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: featured ? 'rgba(244,236,216,.62)' : 'var(--ink-3)',
                  }}>
                    / MONAT
                  </span>
                </div>

                <p style={{
                  fontSize: 13.5, lineHeight: 1.45, margin: 0,
                  color: featured ? 'rgba(244,236,216,.78)' : 'var(--ink-2)',
                }}>
                  {p.pitch}
                </p>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {p.features.map(f => (
                    <li key={f} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 9,
                      fontSize: 13.5, lineHeight: 1.45,
                      color: featured ? 'var(--bone)' : 'var(--ink-1)',
                    }}>
                      <span style={{ color: featured ? 'var(--gold)' : 'var(--accent)', flexShrink: 0, marginTop: 2 }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: 'auto' }}>
                  {isCurrent ? (
                    <button
                      disabled
                      style={{
                        width: '100%', padding: '12px 0',
                        background: featured ? 'var(--bone)' : 'var(--green)',
                        color: featured ? 'var(--green)' : 'var(--bone)',
                        border: 'none', borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                        fontWeight: 600, fontSize: 'var(--t-small-fs)', cursor: 'not-allowed', opacity: 0.85,
                      }}
                    >
                      Dein aktueller Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan(p.id)}
                      disabled={!!checkoutPlan}
                      className={featured ? 'gobl-btn gold' : 'gobl-btn primary'}
                      style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}
                    >
                      {`${p.name} wählen →`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison matrix — collapsed by default, expandable. */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setMatrixOpen(o => !o)}
            className="gobl-btn ghost sm"
          >
            {matrixOpen ? 'Vergleich schließen ↑' : 'Alle Features vergleichen →'}
          </button>
        </div>

        {matrixOpen && (
          <div className="gobl-panel" style={{ overflow: 'hidden', marginBottom: 32 }}>
            {[
              { label: 'Builds / Monat (ca.)', values: [PLAN_BUILDS.build, PLAN_BUILDS.pro, PLAN_BUILDS.power].map(n => `≈ ${n.toLocaleString('de-DE')}`) },
              { label: 'Projekte', values: ['∞', '∞', '∞'] },
              { label: 'Cloud-Storage', values: [storageGbLabel('build'), storageGbLabel('pro'), storageGbLabel('power')] },
              { label: 'BYOK (alle Provider, 2 Keys/Anbieter)', values: ['✓', '✓', '✓'] },
              { label: 'Send to Code', values: ['✓', '✓', '✓'] },
              { label: 'GitHub-Push', values: ['✓', '✓', '✓'] },
              { label: 'Priority Support', values: ['—', '—', '✓'] },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr)',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--line)',
              }}>
                <div style={{
                  padding: '12px 18px', borderRight: '1px solid var(--line)',
                  fontSize: 13.5, color: 'var(--ink-2)',
                }}>
                  {row.label}
                </div>
                {row.values.map((v, j) => (
                  <div key={j} style={{
                    padding: '12px 18px',
                    borderRight: j === 2 ? 'none' : '1px solid var(--line)',
                    fontSize: 13.5, color: v === '—' ? 'var(--ink-4)' : 'var(--ink-1)',
                    fontWeight: v === '✓' ? 600 : 500,
                    fontFamily: v === '✓' || v === '—' ? 'inherit' : 'JetBrains Mono, monospace',
                  }}>
                    {v}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Confidence row — no fake urgency. Honest signals only. */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap',
          marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--line)',
        }}>
          {['JEDERZEIT KÜNDBAR', 'BYOK AUF JEDEM TIER', 'STRIPE · KEIN LOCK-IN'].map(s => (
            <span key={s} style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-3)',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ color: 'var(--accent)' }}>✓</span>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Elements / SetupIntent checkout — card collected here, the BIN-resolved
          price shown on the pay button before any charge (no hosted redirect). */}
      {checkoutPlan && (() => {
        const plan = PLANS.find(x => x.id === checkoutPlan)!;
        // Active subscriber → change-plan (subscriptions.update, saved card, no card
        // entry). Everyone else (trial/comped/none) → subscribe (collect card).
        if (planState === 'paid') {
          return (
            <ChangePlanPanel
              plan={plan.id}
              planName={plan.name}
              onClose={() => setCheckoutPlan(null)}
              onSuccess={() => { window.location.href = '/dashboard/settings/billing/success'; }}
            />
          );
        }
        return (
          <CheckoutPanel
            plan={plan.id}
            planName={plan.name}
            displayPrice={priceFor(plan)}
            onClose={() => setCheckoutPlan(null)}
            onSuccess={() => { window.location.href = '/dashboard/settings/billing/success'; }}
          />
        );
      })()}
    </div>
  );
}
