'use client';

// Elements / SetupIntent checkout (2026-06-23 rebuild).
//
// Replaces the hosted-Checkout redirect. Card is collected via Stripe Elements,
// tokenized with a SetupIntent (NO charge), then the API reads the card's BIN
// issuing country and returns the AUTHORITATIVE price. The pay button always
// shows the price that will actually be charged:
//   • resolved tier == displayed (IP) tier  → single click, charge (no friction).
//   • resolved tier differs                  → button updates to the real price +
//     a one-line note appears, and the user re-confirms the updated amount before
//     the subscription is created. We never charge more than the button showed.

import { useEffect, useRef, useState } from 'react';
import { loadStripe, type Stripe, type Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { useLang, t, type Lang } from '@/lib/use-lang';

type PlanId = 'build' | 'pro' | 'power';

interface ResolvedPrice {
  displayTier: number;
  resolvedTier: number;
  priceId: string;
  amount: number;
  currency: string;
  differs: boolean;
  note: { en: string; de: string } | null;
}

let _stripePromise: Promise<Stripe | null> | null = null;
function stripePromise(): Promise<Stripe | null> {
  if (!_stripePromise) {
    _stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');
  }
  return _stripePromise;
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#1f6f43',
    colorText: '#13231b',
    colorBackground: '#ffffff',
    fontFamily: 'Manrope, system-ui, sans-serif',
    borderRadius: '8px',
  },
};

export function CheckoutPanel({
  plan,
  planName,
  displayPrice,
  onClose,
  onSuccess,
}: {
  plan: PlanId;
  planName: string;
  displayPrice: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const lang = useLang();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/billing/setup-intent`, { method: 'POST', headers });
        if (!r.ok) throw new Error('init');
        const d = await r.json();
        setClientSecret(d.clientSecret);
      } catch {
        setErr(t(lang, 'Zahlung konnte nicht gestartet werden.', 'Could not start payment.'));
      }
    })();
  }, [lang]);

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
          {t(lang, `${planName} abonnieren`, `Subscribe to ${planName}`)}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 18px' }}>
          {t(lang, 'Sicher bezahlen mit Stripe · jederzeit kündbar.', 'Secure payment via Stripe · cancel anytime.')}
        </p>

        {err ? (
          <div style={{ color: 'var(--danger)', fontSize: 13.5, marginBottom: 16 }}>{err}</div>
        ) : !clientSecret ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13.5, padding: '24px 0', textAlign: 'center' }}>
            {t(lang, 'Lädt …', 'Loading …')}
          </div>
        ) : (
          <Elements stripe={stripePromise()} options={{ clientSecret, appearance }}>
            <CheckoutForm
              plan={plan}
              displayPrice={displayPrice}
              lang={lang}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}

function CheckoutForm({
  plan,
  displayPrice,
  lang,
  onSuccess,
  onClose,
}: {
  plan: PlanId;
  displayPrice: number;
  lang: Lang;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedPrice | null>(null);
  const pmRef = useRef<string | null>(null); // payment method, set once card is tokenized

  // The button always shows the price that will be charged on the NEXT click.
  const shownAmount = resolved?.amount ?? displayPrice;
  const note = resolved?.differs ? (lang === 'en' ? resolved.note?.en : resolved.note?.de) : null;

  async function callCreate(priceId: string): Promise<'done' | 'reconfirm' | 'error'> {
    const headers = await getAuthHeaders();
    const r = await fetch(`${API_URL}/api/billing/create-subscription`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetPlan: plan, paymentMethodId: pmRef.current, confirmedPriceId: priceId }),
    });
    if (r.status === 409) {
      const d = await r.json();
      if (d?.resolved) { setResolved(d.resolved as ResolvedPrice); } // price drifted → re-show
      return 'reconfirm';
    }
    if (!r.ok) return 'error';
    return 'done';
  }

  async function handlePay() {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setErr(null);
    try {
      // First click: tokenize the card (SetupIntent, no charge) and read its country.
      if (!pmRef.current) {
        const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
        if (error) {
          setErr(error.message ?? t(lang, 'Karte konnte nicht bestätigt werden.', 'Could not confirm card.'));
          return;
        }
        const pm = typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id ?? null;
        if (!pm) {
          setErr(t(lang, 'Zahlungsmethode fehlt.', 'Payment method missing.'));
          return;
        }
        pmRef.current = pm;

        // Resolve the authoritative card-country price.
        const headers = await getAuthHeaders();
        const rr = await fetch(`${API_URL}/api/billing/resolve-price`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ targetPlan: plan, paymentMethodId: pm }),
        });
        if (!rr.ok) { setErr(t(lang, 'Preis konnte nicht ermittelt werden.', 'Could not resolve price.')); return; }
        const rp = await rr.json() as ResolvedPrice;

        if (rp.differs) {
          // Surface the updated price + note; require an explicit re-confirm click.
          setResolved(rp);
          return;
        }
        // Matched — no extra friction: charge now at the displayed price.
        const res = await callCreate(rp.priceId);
        if (res === 'done') { onSuccess(); return; }
        if (res === 'reconfirm') return; // server saw a drift → button now shows new price
        setErr(t(lang, 'Abonnement fehlgeschlagen.', 'Subscription failed.'));
        return;
      }

      // Second click (re-confirm of a differing amount): charge the shown price.
      const priceId = resolved?.priceId;
      if (!priceId) { setErr(t(lang, 'Bitte erneut versuchen.', 'Please try again.')); return; }
      const res = await callCreate(priceId);
      if (res === 'done') { onSuccess(); return; }
      if (res === 'reconfirm') return;
      setErr(t(lang, 'Abonnement fehlgeschlagen.', 'Subscription failed.'));
    } catch {
      setErr(t(lang, 'Etwas ist schiefgelaufen.', 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PaymentElement options={{ layout: 'tabs' }} />

      {note && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--accent-bright)', border: '1px solid var(--accent-rule)',
          borderRadius: 'var(--radius)', padding: '10px 12px',
          fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.4,
        }}>
          <span aria-hidden style={{ color: 'var(--accent)' }}>ⓘ</span>
          <span>{note}</span>
        </div>
      )}

      {err && (
        <div style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.4 }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" className="gobl-btn secondary" style={{ flex: 1 }} onClick={onClose} disabled={busy}>
          {t(lang, 'Abbrechen', 'Cancel')}
        </button>
        <button type="button" className="gobl-btn primary" style={{ flex: 1.6, justifyContent: 'center' }} onClick={handlePay} disabled={busy || !stripe}>
          {busy
            ? t(lang, 'Wird verarbeitet …', 'Processing …')
            : t(lang, `Abonnieren · $${shownAmount}/Monat`, `Subscribe · $${shownAmount}/mo`)}
        </button>
      </div>
    </div>
  );
}
