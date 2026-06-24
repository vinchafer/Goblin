'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { buildsPerMonth, PLAN_BUILDS } from '@/lib/plan-builds';

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
      '3 Projekte',
      'BYOK — alle Provider, kein Goblin-Limit',
      'Send to Code',
      '5 GB Cloud-Storage',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    monthlyBuilds: PLAN_BUILDS.pro,
    meta: 'FÜR REGELMÄSSIGE BUILDER',
    pitch: 'Mehr monatliches Kontingent, Auto-Fallback wenn ein Key streikt.',
    features: [
      buildsPerMonth('pro', 'de'),
      '50 Projekte',
      'BYOK — kein Goblin-Limit',
      '20 GB Cloud-Storage',
      'GitHub + Vercel Auto-Deploy',
      'Auto-Fallback-Routing',
    ],
  },
  {
    id: 'power',
    name: 'Power',
    price: 39,
    monthlyBuilds: PLAN_BUILDS.power,
    meta: 'WENN DU MEHR KONTINGENT BRAUCHST',
    pitch: 'Mehr Durchsatz für Power-Builder. Priority-Routing, Unlimited Projekte.',
    features: [
      buildsPerMonth('power', 'de'),
      'Unlimitierte Projekte',
      'BYOK · Priority-Routing',
      '100 GB Cloud-Storage',
      'Erweiterte Modell-Auswahl',
      'Beta-Features 30 Tage früher',
    ],
    featured: true,
  },
];

export default function UpgradePage() {
  const search = useSearchParams();
  const reason = search?.get('reason'); // ?reason=limit-hit emphasises requests
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<PlanId | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/billing/status`, { headers });
        if (r.ok) {
          const data = await r.json();
          setCurrentPlan(data.plan ?? null);
        }
      } catch { /* ignore — page still works without current-plan info */ }
    })();
  }, []);

  // Stripe Checkout. Per decision: NEVER charge directly — the button on
  // each card opens the confirmation modal; Checkout starts only after
  // explicit confirmation.
  const startCheckout = async (targetPlan: PlanId) => {
    setLoadingPlan(targetPlan);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetPlan,
          successUrl: `${window.location.origin}/dashboard/settings/billing/success`,
          cancelUrl: `${window.location.origin}/dashboard/upgrade`,
        }),
      });
      if (!res.ok) throw new Error('Checkout konnte nicht gestartet werden.');
      const data = await res.json() as { url: string };
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Etwas ist schiefgelaufen.');
      setLoadingPlan(null);
    }
  };

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
            <span className="num">DEIN PLAN · {(currentPlan ?? 'BUILD').toUpperCase()}</span>
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
            const isLoading = loadingPlan === p.id;
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
                    ${p.price}
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
                      onClick={() => setConfirmPlan(p.id)}
                      disabled={!!loadingPlan}
                      className={featured ? 'gobl-btn gold' : 'gobl-btn primary'}
                      style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}
                    >
                      {isLoading ? 'Lade …' : `${p.name} wählen →`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-soft)', border: '1px solid rgba(160,66,48,.30)',
            borderRadius: 'var(--radius)', padding: 14, color: 'var(--danger)',
            marginBottom: 24, fontSize: 13.5, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

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
              { label: 'Projekte', values: ['3', '50', '∞'] },
              { label: 'Cloud-Storage', values: ['5 GB', '20 GB', '100 GB'] },
              { label: 'BYOK (alle Provider)', values: ['✓', '✓', '✓'] },
              { label: 'Auto-Fallback-Routing', values: ['—', '✓', '✓'] },
              { label: 'GitHub + Vercel Auto-Deploy', values: ['—', '✓', '✓'] },
              { label: 'Erweiterte Modell-Auswahl', values: ['—', '—', '✓'] },
              { label: 'Beta-Features früher', values: ['—', '—', '30 Tage'] },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr)',
                borderBottom: i === 7 ? 'none' : '1px solid var(--line)',
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

      {/* Confirmation modal — purchase requires explicit consent (decision). */}
      {confirmPlan && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(15,43,30,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setConfirmPlan(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--d-surface-elev)', borderRadius: 'var(--radius-lg)',
            padding: 28, width: 440, maxWidth: '92vw', border: '1px solid var(--line)',
          }}>
            {(() => {
              const plan = PLANS.find(x => x.id === confirmPlan)!;
              return (
                <>
                  <h2 style={{
                    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                    fontWeight: 600, fontSize: 20, color: 'var(--ink-1)', margin: '0 0 8px',
                  }}>
                    Plan wechseln zu {plan.name}
                  </h2>
                  <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ink-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Du wirst zu Stripe weitergeleitet, um die Zahlung zu bestätigen.
                    ${plan.price}/Monat. {buildsPerMonth(plan.id, 'de')}.
                    Jederzeit kündbar.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="gobl-btn secondary" style={{ flex: 1 }} onClick={() => setConfirmPlan(null)}>
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      className="gobl-btn primary"
                      style={{ flex: 1 }}
                      onClick={() => { const id = confirmPlan; setConfirmPlan(null); if (id) startCheckout(id); }}
                    >
                      Zu Stripe →
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
