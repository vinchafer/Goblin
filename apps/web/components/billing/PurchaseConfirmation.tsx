'use client';

// F-32 (FIX-WAVE 3) — the purchase-confirmation moment.
//
// After a purchase is VERIFIED (billing status planState === 'paid'), the user
// currently lands silently in the dashboard. This is the single warm, honest
// confirmation that D-A relocated the trial banner's emotion into. It reads the
// verified state (NOT the checkout redirect), shows once per plan, and pulls its
// numbers from the single plan sources. House register: warm, plain, no marketing
// filler; DE + EN; one CTA back to the work.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, apiPost } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';
import { isDemoActive } from '@/lib/demo/demo-flag';
import {
  shouldShowPurchaseConfirmation,
  planDisplayName,
  unlockedFeatures,
  type PaidPlan,
} from '@/lib/purchase-confirmation';

interface BillingStatusLite {
  plan?: string | null;
  planState?: 'comped' | 'paid' | 'trial' | 'none';
  // F-32: server-side "seen" flag (migration 0093). `planConfirmationServer` is true once
  // the column is live; until then it is absent/false and we fall back to localStorage.
  lastConfirmedPlan?: string | null;
  planConfirmationServer?: boolean;
}

const SEEN_KEY = 'goblin_confirmed_plan';

export function PurchaseConfirmation() {
  const lang = useLang();
  // `plan` is only ever set inside the client effect below, so both the server
  // render and the first client render return null (no hydration mismatch) — no
  // separate "mounted" flag needed to guard the portal.
  const [plan, setPlan] = useState<PaidPlan | null>(null);

  useEffect(() => {
    if (isDemoActive()) return;
    let alive = true;
    apiGet<BillingStatusLite>('/api/billing/status')
      .then((s) => {
        if (!alive) return;
        // F-32: the "already celebrated" marker is now server-side (cross-device). When
        // the server flag is live (planConfirmationServer), it is authoritative; until
        // the 0093 column is applied we fall back to device-local localStorage so the
        // pre-migration per-device behavior is preserved with no regression.
        const localSeen = (() => {
          try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
        })();
        const lastConfirmedPlan = s.planConfirmationServer ? (s.lastConfirmedPlan ?? null) : localSeen;
        // Trigger off the VERIFIED state only. shouldShow returns false for trial /
        // none / comped / an undefined (pending or failed checkout) state.
        const { show, plan: p } = shouldShowPurchaseConfirmation({
          planState: s.planState,
          plan: s.plan,
          lastConfirmedPlan,
        });
        if (show && p) setPlan(p);
      })
      .catch(() => { /* silent — never celebrate on an unknown state */ });
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    if (plan) {
      // Persist to BOTH: the server flag (so it doesn't re-fire on another device) and
      // localStorage (the fallback while migration 0093 is still dark). The server call
      // is fire-and-forget — a failure just leaves the localStorage marker in charge.
      void apiPost('/api/billing/confirm-plan').catch(() => { /* localStorage covers it */ });
      try { localStorage.setItem(SEEN_KEY, plan); } catch { /* ignore */ }
    }
    setPlan(null);
  };

  if (!plan || typeof document === 'undefined') return null;

  const features = unlockedFeatures(plan, lang);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'Kauf bestätigt', 'Purchase confirmed')}
      data-testid="purchase-confirmation"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        onClick={dismiss}
        style={{ position: 'absolute', inset: 0, background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)', animation: 'gobFadeIn 200ms ease' }}
      />
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 420,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-3)',
          padding: '32px 28px', textAlign: 'center',
          animation: 'gobConfIn 260ms cubic-bezier(0.2,0.9,0.3,1)',
        }}
      >
        {/* Sage confirmation mark (primary accent) */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary-rule)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{ fontSize: 'var(--t-h2-fs, 24px)', fontWeight: 700, color: 'var(--brand-fg)', margin: '0 0 8px' }}>
          {t(lang, `Willkommen im ${planDisplayName(plan)}-Plan`, `Welcome to the ${planDisplayName(plan)} plan`)}
        </h2>
        <p style={{ fontSize: 'var(--t-body-fs, 15px)', color: 'var(--text-2)', margin: '0 0 22px', lineHeight: 1.5 }}>
          {t(lang,
            'Dein Abo ist aktiv. Kein Countdown mehr — bau einfach weiter.',
            'Your subscription is active. No more countdown — just keep building.')}
        </p>

        {/* What's now unlocked — real numbers, single-sourced */}
        <div style={{
          textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 'var(--t-caption-fs, 12px)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--meta)', marginBottom: 10 }}>
            {t(lang, 'Jetzt freigeschaltet', "What's now unlocked")}
          </div>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '6px 0', fontSize: 'var(--t-small-fs, 14px)', color: 'var(--text)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{f}</span>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          style={{
            width: '100%', padding: '14px 20px', background: 'var(--brand-green)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--t-body-fs, 15px)',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {t(lang, "Los geht's", "Let's go")}
        </button>
      </div>

      <style>{`
        @keyframes gobFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gobConfIn { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>,
    document.body,
  );
}
