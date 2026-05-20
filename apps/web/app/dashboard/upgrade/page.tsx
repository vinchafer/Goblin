'use client';
import { useState, useEffect } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';

type PlanId = 'build' | 'pro' | 'power';

interface PlanCardData {
  id: PlanId;
  name: string;
  price: number;
  requests: number;
  highlight?: boolean;
  pitch: string;
  features: string[];
}

const PLANS: PlanCardData[] = [
  {
    id: 'build',
    name: 'Build',
    price: 9,
    requests: 200,
    pitch: 'Für Einzelbastler. Lerne, baue, ship.',
    features: [
      '200 AI-Anfragen / Monat',
      'Alle AI-Provider (BYOK)',
      'Chat + Code + Preview',
      'GitHub-Push',
      '5 GB Cloud-Storage',
      'Send to Code',
      'Mobile + Desktop',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    requests: 800,
    highlight: true,
    pitch: 'Für aktive Builder. 4× mehr Anfragen.',
    features: [
      '800 AI-Anfragen / Monat',
      'Alles aus Build',
      'Prioritäts-Routing',
      '20 GB Cloud-Storage',
      'Web Push',
      'Erweiterte Modell-Auswahl',
    ],
  },
  {
    id: 'power',
    name: 'Power',
    price: 39,
    requests: 3000,
    pitch: 'Für Profis & Teams. Maximaler Durchsatz.',
    features: [
      '3.000 AI-Anfragen / Monat',
      'Alles aus Pro',
      'Premium-Modelle ohne Limit',
      '100 GB Cloud-Storage',
      'Schneller Support',
      'Early Access Features',
    ],
  },
];

export default function UpgradePage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/billing/status`, { headers });
        if (r.ok) {
          const data = await r.json();
          setCurrentPlan(data.plan ?? null);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleCheckout = async (targetPlan: PlanId) => {
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2, var(--cream))', fontFamily: 'DM Sans, sans-serif' }}>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 16px 80px' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700,
            color: 'var(--text)', margin: '0 0 10px', letterSpacing: '-0.02em',
          }}>
            Wähle deinen Plan
          </h1>
          <p style={{ fontSize: 16, color: 'var(--meta)', maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
            Alle Pläne mit BYOK. Du zahlst Inferenz direkt bei deinem Provider — Goblin nimmt $0 extra.
          </p>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
          alignItems: 'stretch',
        }}>
          {PLANS.map((p) => {
            const isCurrent = currentPlan === p.id;
            const isLoading = loadingPlan === p.id;
            return (
              <div key={p.id} style={{
                background: 'var(--panel, #fff)',
                border: p.highlight ? '2px solid var(--moss)' : '1px solid var(--border)',
                borderRadius: 16,
                padding: '28px 24px',
                display: 'flex', flexDirection: 'column',
                position: 'relative',
                boxShadow: p.highlight ? '0 12px 36px -16px rgba(45,74,43,0.30)' : '0 1px 0 rgba(0,0,0,0.03)',
              }}>
                {p.highlight && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--moss)', color: '#fff',
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '4px 12px', borderRadius: 999,
                  }}>Populär</div>
                )}

                <div style={{
                  fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700,
                  color: 'var(--text)', marginBottom: 4,
                }}>{p.name}</div>
                <p style={{ fontSize: 13, color: 'var(--meta)', margin: '0 0 18px', lineHeight: 1.5 }}>
                  {p.pitch}
                </p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 22 }}>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 700, color: 'var(--moss)' }}>
                    ${p.price}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--meta)' }}>/Monat</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 3, flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled style={{
                    width: '100%', padding: '12px 0',
                    background: 'transparent', color: 'var(--moss)',
                    border: '1.5px solid var(--moss)', borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: 'not-allowed',
                  }}>
                    Dein aktueller Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(p.id)}
                    disabled={!!loadingPlan}
                    style={{
                      width: '100%', padding: '12px 0',
                      background: p.highlight ? 'var(--moss)' : 'transparent',
                      color: p.highlight ? '#fff' : 'var(--moss)',
                      border: p.highlight ? 'none' : '1.5px solid var(--moss)',
                      borderRadius: 10,
                      fontSize: 14, fontWeight: 600,
                      cursor: loadingPlan ? 'wait' : 'pointer',
                      opacity: loadingPlan && !isLoading ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? 'Lade…' : `${p.name} wählen`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            marginTop: 24, textAlign: 'center',
            fontSize: 13, color: 'var(--danger, #c64a4a)',
          }}>{error}</div>
        )}

        <p style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: 'var(--meta)' }}>
          Sicheres Checkout via Stripe. Kündigung jederzeit im Kundenportal.
        </p>
      </main>
    </div>
  );
}
