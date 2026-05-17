'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';

interface BillingState {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cardLast4: string | null;
}

export function BillingPage() {
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/billing/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) setState(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        const { url } = await r.json();
        if (url) window.location.href = url;
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-ui)' }}>Lade Abrechnung...</div>;

  const plan = state?.plan ?? 'Trial';
  const trialEnds = state?.trialEndsAt ? new Date(state.trialEndsAt).toLocaleDateString('de-DE') : null;
  const renewsAt = state?.currentPeriodEnd ? new Date(state.currentPeriodEnd).toLocaleDateString('de-DE') : null;

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-ui)' }}>
      <SettingsGroup label="Aktueller Plan">
        <SettingsCard>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Plan</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-brand)' }}>{plan}</div>
            {trialEnds && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ochre)' }}>Trial endet {trialEnds}</div>
            )}
            {renewsAt && !trialEnds && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-meta)' }}>Nächste Abbuchung {renewsAt}</div>
            )}
          </div>
        </SettingsCard>
      </SettingsGroup>

      {state?.cardLast4 && (
        <SettingsGroup label="Zahlungsmethode">
          <SettingsCard>
            <SettingsRow label={`•••• ${state.cardLast4}`} right="Ändern" rightVariant="text" />
          </SettingsCard>
        </SettingsGroup>
      )}

      <SettingsGroup label="Verwaltung">
        <SettingsCard>
          <SettingsRow label={busy ? 'Lade Portal…' : 'Plan & Rechnungen verwalten'} onClick={openPortal} disabled={busy} />
          <SettingsRow label="Upgrade ansehen" onClick={() => { window.location.href = '/dashboard/upgrade'; }} />
        </SettingsCard>
      </SettingsGroup>

      <p style={{ fontSize: 12, color: 'var(--text-meta)', marginTop: 16, padding: '0 4px', lineHeight: 1.6 }}>
        Sicheres Checkout & Rechnungen über Stripe. Kündigung jederzeit im Kundenportal.
      </p>
    </div>
  );
}
