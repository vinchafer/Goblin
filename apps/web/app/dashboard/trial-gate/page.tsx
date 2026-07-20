'use client';

// Trial-Activation 2026-06-25 — the ACTIVE choice screen.
//
// A user with no active subscription, no comp and no active trial lands here
// (redirected by the dashboard shell on a 402 / 'none' state). They must pick:
// start the free trial, or subscribe. Minimal functional plumbing — the
// conversion-optimized version is a later session.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders, API_URL, apiGet } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';
import { PromoCodeField } from '@/components/billing/PromoCodeField';

interface TrialInfo {
  trialStatus: 'not_started' | 'active' | 'expired' | 'subscribed' | 'none';
}

export default function TrialGatePage() {
  const router = useRouter();
  const lang = useLang();
  const [status, setStatus] = useState<TrialInfo['trialStatus'] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<TrialInfo>('/api/users/me/trial')
      .then((info) => {
        // Already entitled → never trap them on the gate.
        if (info.trialStatus === 'subscribed' || info.trialStatus === 'active') {
          router.replace('/dashboard');
          return;
        }
        setStatus(info.trialStatus);
      })
      .catch(() => setStatus('not_started'));
  }, [router]);

  const startTrial = async () => {
    setStarting(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/users/me/trial/start`, { method: 'POST', headers });
      if (!res.ok) throw new Error('start failed');
      router.replace('/dashboard?tour=1');
    } catch {
      setError(t(lang, 'Konnte die Testphase nicht starten. Bitte erneut versuchen.', 'Could not start the trial. Please try again.'));
      setStarting(false);
    }
  };

  const expired = status === 'expired';

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
        background: 'var(--surface-page)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'var(--t-h2-fs, 24px)',
            fontWeight: 700,
            // F-03/04: was --brand-green (locked → invisible headline on dark).
            color: 'var(--brand-fg)',
            margin: '0 0 8px',
          }}
        >
          {expired
            ? t(lang, 'Deine Testphase ist beendet', 'Your free trial has ended')
            : t(lang, 'Willkommen bei Goblin', 'Welcome to Goblin')}
        </h1>
        <p
          style={{
            fontSize: 'var(--t-body-fs, 15px)',
            color: 'var(--text-2)', // F-03/04: was rgba(0,0,0,0.6) → black-on-dark
            margin: '0 0 28px',
            lineHeight: 1.5,
          }}
        >
          {expired
            ? t(lang, 'Schließe ein Abo ab, um Goblin Cloud weiter zu nutzen.', 'Subscribe to keep using Goblin Cloud.')
            : t(lang, 'Wähle, wie du loslegst — kostenlose Testphase oder direkt ein Abo.', 'Choose how to start — a free trial or a subscription.')}
        </p>

        {/* TRIAL-7 T3: the expired screen was honest but vague — it never said what
            happens to the user's work. This is the specific, verified truth: expiry
            gates only new paid actions; projects, code and already-published apps
            persist (no teardown runs on expiry), and read/download/GitHub push stay
            open. No promise beyond what the code actually does. */}
        {expired && (
          <p
            style={{
              fontSize: 'var(--t-small-fs, 13px)',
              color: 'var(--text-2)', // F-03: was rgba(0,0,0,0.55) → black-on-dark
              margin: '-16px 0 28px',
              lineHeight: 1.55,
            }}
          >
            {t(
              lang,
              'Deine Projekte und bereits veröffentlichten Apps bleiben erhalten und online. Du kannst dich weiterhin anmelden, deinen Code herunterladen und zu GitHub pushen. Mit einem Abo arbeitest du sofort weiter.',
              'Your projects and already-published apps stay — and stay online. You can still sign in, download your code, and push to GitHub. Subscribe to pick up right where you left off.',
            )}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!expired && (
            <button
              onClick={startTrial}
              disabled={starting}
              style={{
                padding: '14px 20px',
                background: 'var(--brand-green, #2d4a2b)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 'var(--t-body-fs, 15px)',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.6 : 1,
              }}
            >
              {starting
                ? t(lang, 'Startet…', 'Starting…')
                : t(lang, '7 Tage kostenlos testen', 'Start 7-day free trial')}
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard/upgrade')}
            style={{
              padding: '14px 20px',
              background: expired ? 'var(--brand-green, #2d4a2b)' : 'transparent',
              // F-04: secondary (non-expired) button was locked --brand-green text
              // + border on a flipping surface → invisible on dark. Flip both.
              color: expired ? '#fff' : 'var(--brand-fg)',
              border: expired ? 'none' : '1.5px solid var(--brand-fg)',
              borderRadius: 10,
              fontSize: 'var(--t-body-fs, 15px)',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            {t(lang, 'Abo abschließen', 'Subscribe')}
          </button>
        </div>

        {/* FOUNDER-WALK-1 U2: the invite-code entry belongs where the user meets the
            plan decision, not buried in Settings → Billing. Quiet trigger below the
            plan options; tapping expands the SAME PromoCodeField (one component, one
            redemption path, same validation + honest DE/EN errors). The test
            invitations go out with these codes, so the paywall is exactly where an
            invited user expects to enter one. Settings/billing entry stays as-is. */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <PromoCodeField
            collapsedLabel={{ de: 'Hast du einen Invite-Code?', en: 'Have an invite code?' }}
          />
        </div>

        {error && (
          <p style={{ marginTop: 16, color: 'var(--danger, #b85c3c)', fontSize: 'var(--t-small-fs, 13px)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
