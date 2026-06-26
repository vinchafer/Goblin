'use client';

// Change-plan panel for EXISTING subscribers (2026-06-25).
//
// An active subscriber who switches plans must NOT re-enter a card and must NOT
// get a second subscription. This panel previews the prorated amount Stripe will
// charge now (or credit) via subscriptions.update, and the confirm button shows
// that real amount. No PaymentElement, no SetupIntent — the saved card is reused.

import { useEffect, useState } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';

type PlanId = 'build' | 'pro' | 'power';

interface PlanChangePreview {
  hasActiveSubscription: boolean;
  samePlan: boolean;
  newPlan: PlanId;
  newPriceId: string;
  tier: number;
  newMonthlyAmount: number;
  amountDueNow: number;
  creditAmount: number;
  currency: string;
}

function money(amount: number, currency: string): string {
  const cur = (currency || 'usd').toUpperCase();
  if (cur === 'USD') return `$${amount.toFixed(2)}`;
  return `${amount.toFixed(2)} ${cur}`;
}

export function ChangePlanPanel({
  plan,
  planName,
  onClose,
  onSuccess,
}: {
  plan: PlanId;
  planName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const lang = useLang();
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPreview() {
    setErr(null);
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API_URL}/api/billing/change-plan-preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetPlan: plan }),
      });
      if (r.status === 409) {
        // No live subscription after all → this user belongs on the subscribe path.
        setErr(t(lang,
          'Kein aktives Abo gefunden. Bitte Seite neu laden.',
          'No active subscription found. Please reload the page.'));
        return;
      }
      if (!r.ok) throw new Error('preview');
      setPreview(await r.json() as PlanChangePreview);
    } catch {
      setErr(t(lang, 'Vorschau konnte nicht geladen werden.', 'Could not load preview.'));
    }
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  async function handleConfirm() {
    if (!preview || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API_URL}/api/billing/change-plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetPlan: plan, confirmedPriceId: preview.newPriceId }),
      });
      if (r.status === 409) {
        // Price drifted under us (tier changed) or sub vanished → re-preview so the
        // confirm shows the new real amount; never apply a price the user didn't see.
        await loadPreview();
        setErr(t(lang,
          'Der Preis hat sich aktualisiert. Bitte den neuen Betrag bestätigen.',
          'The price was updated. Please confirm the new amount.'));
        return;
      }
      if (!r.ok) throw new Error('apply');
      onSuccess();
    } catch {
      setErr(t(lang, 'Planwechsel fehlgeschlagen.', 'Plan change failed.'));
    } finally {
      setBusy(false);
    }
  }

  const isUpgrade = preview && preview.amountDueNow > 0;
  const isCredit = preview && preview.creditAmount > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,43,30,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--d-surface-elev)', borderRadius: 'var(--radius-lg)',
          padding: 28, width: 460, maxWidth: '92vw', border: '1px solid var(--line)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
          fontWeight: 600, fontSize: 20, color: 'var(--ink-1)', margin: '0 0 4px',
        }}>
          {t(lang, `Auf ${planName} wechseln`, `Switch to ${planName}`)}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 18px' }}>
          {t(lang,
            'Deine gespeicherte Karte wird verwendet · jederzeit kündbar.',
            'Your saved card is used · cancel anytime.')}
        </p>

        {err && (
          <div style={{ color: 'var(--danger)', fontSize: 13.5, marginBottom: 16, lineHeight: 1.4 }}>{err}</div>
        )}

        {!preview && !err ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13.5, padding: '24px 0', textAlign: 'center' }}>
            {t(lang, 'Lädt …', 'Loading …')}
          </div>
        ) : preview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* New recurring price */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '12px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                {t(lang, 'Neuer Monatspreis', 'New monthly price')}
              </span>
              <span style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontWeight: 600, fontSize: 22, color: 'var(--ink-1)',
              }}>
                {money(preview.newMonthlyAmount, preview.currency)}
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>
                  {t(lang, ' / Monat', ' / mo')}
                </span>
              </span>
            </div>

            {/* Proration line — what happens right now */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--accent-bright)', border: '1px solid var(--accent-rule)',
              borderRadius: 'var(--radius)', padding: '10px 12px',
              fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.4,
            }}>
              <span aria-hidden style={{ color: 'var(--accent)' }}>ⓘ</span>
              <span>
                {isUpgrade
                  ? t(lang,
                      `Jetzt anteilig berechnet: ${money(preview.amountDueNow, preview.currency)}`,
                      `Charged now (prorated): ${money(preview.amountDueNow, preview.currency)}`)
                  : isCredit
                  ? t(lang,
                      `Anteilige Gutschrift: ${money(preview.creditAmount, preview.currency)} (auf künftige Rechnungen)`,
                      `Prorated credit: ${money(preview.creditAmount, preview.currency)} (applied to future invoices)`)
                  : t(lang,
                      'Keine sofortige Berechnung.',
                      'No charge due now.')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="gobl-btn secondary" style={{ flex: 1 }} onClick={onClose} disabled={busy}>
                {t(lang, 'Abbrechen', 'Cancel')}
              </button>
              <button
                type="button"
                className="gobl-btn primary"
                style={{ flex: 1.6, justifyContent: 'center' }}
                onClick={handleConfirm}
                disabled={busy}
              >
                {busy
                  ? t(lang, 'Wird verarbeitet …', 'Processing …')
                  : isUpgrade
                  ? t(lang,
                      `Wechseln · jetzt ${money(preview.amountDueNow, preview.currency)}`,
                      `Switch · pay ${money(preview.amountDueNow, preview.currency)} now`)
                  : t(lang, 'Wechsel bestätigen', 'Confirm switch')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
