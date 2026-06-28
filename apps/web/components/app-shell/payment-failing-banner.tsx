'use client';
import { useEffect, useState } from 'react';
import { apiGet, getAuthHeaders, API_URL } from '@/lib/api';
import { isDemoActive } from '@/lib/demo/demo-flag';
import { useLang, t } from '@/lib/use-lang';

interface BillingStatus {
  planState?: string;
  paymentFailing?: boolean;
  paymentDeadline?: string | null;
}

/**
 * Dunning warning (2026-06-27). When the last renewal charge failed the sub is
 * past_due — access is KEPT during Stripe's retry window, but the user must update
 * their card before the final cancel. Prominent, NOT dismissible (clears itself the
 * moment invoice.payment_succeeded flips paymentFailing back to false). Customer
 * EMAILs are handled by Stripe's built-in dunning emails (Dashboard toggle).
 */
export function PaymentFailingBanner() {
  const lang = useLang();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDemoActive()) return;
    apiGet<BillingStatus>('/api/billing/status').then(setStatus).catch(() => null);
  }, []);

  async function openPortal() {
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API_URL}/api/billing/create-portal-session`, { method: 'POST', headers });
      if (r.ok) {
        const { portalUrl, url } = await r.json();
        const target = portalUrl ?? url;
        if (target) { window.location.href = target; return; }
      }
    } catch { /* leave button enabled to retry */ }
    setBusy(false);
  }

  if (!status?.paymentFailing) return null;

  const deadline = status.paymentDeadline
    ? new Date(status.paymentDeadline).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US')
    : null;

  return (
    <div style={{
      background: 'rgba(184,92,60,0.12)',
      borderBottom: '2px solid rgba(184,92,60,0.45)',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexShrink: 0, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 'var(--t-small-fs)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
        {t(
          lang,
          'Deine letzte Zahlung ist fehlgeschlagen — bitte aktualisiere deine Zahlungsmethode.',
          'Your last payment failed — please update your payment method.',
        )}
        {deadline && (
          <span style={{ opacity: 0.85, fontWeight: 400 }}>
            {' '}
            {t(lang, `Nächster Versuch am ${deadline}.`, `Next attempt on ${deadline}.`)}
          </span>
        )}
      </span>
      <button
        onClick={openPortal}
        disabled={busy}
        style={{
          padding: '5px 14px', background: 'var(--danger)', color: '#fff',
          border: 'none', borderRadius: 7, fontSize: 'var(--t-caption-fs)', fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', opacity: busy ? 0.6 : 1,
        }}
      >
        {busy
          ? t(lang, 'Lade Portal…', 'Loading portal…')
          : t(lang, 'Zahlungsmethode aktualisieren →', 'Update payment method →')}
      </button>
    </div>
  );
}
