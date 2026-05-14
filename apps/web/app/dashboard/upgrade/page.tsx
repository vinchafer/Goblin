'use client';
import { useState } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';

const FEATURES = [
  'Unlimited projects',
  'All AI providers (BYOK — bring your own keys)',
  'Chat + Code + Preview workspace',
  'GitHub push integration',
  '5GB cloud storage',
  'Send to Code — one-tap from chat',
  'Web push notifications',
  'Mobile access from anywhere',
];

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetPlan: 'build', successUrl: `${window.location.origin}/dashboard/settings/billing/success`, cancelUrl: `${window.location.origin}/dashboard/upgrade` }),
      });
      if (!res.ok) throw new Error('Could not start checkout. Please try again.');
      const data = await res.json() as { url: string };
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
      {/* Logo */}
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--moss)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)', fontFamily: 'Fraunces, serif' }}>G</span>
      </div>

      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.5px' }}>
        Upgrade to Goblin
      </h1>
      <p style={{ fontSize: 14, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, marginBottom: 32 }}>
        Build from anywhere. No token panic. No copy-paste.
      </p>

      {/* Price card */}
      <div style={{
        background: '#fff', border: '2px solid #2D4A2B',
        borderRadius: 16, padding: '28px 28px 24px',
        marginBottom: 24, textAlign: 'left',
        boxShadow: '0 4px 24px rgba(45,74,43,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: 'var(--moss)', fontFamily: 'Fraunces, serif' }}>$9</span>
          <span style={{ fontSize: 14, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>/month</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif', marginBottom: 20 }}>
          Cancel anytime. No commitment.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: '100%', padding: '13px 0',
            background: loading ? 'rgba(45,74,43,0.6)' : 'var(--moss)',
            color: 'var(--ochre)', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.2px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#3a5f38'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--moss)'; }}
        >
          {loading ? 'Redirecting to checkout...' : 'Get Goblin — $9/mo'}
        </button>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
        Secure checkout via Stripe. Your card is never stored by Goblin.
      </div>
    </div>
  );
}
