'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setAnalyticsOptOut } from '@/lib/analytics';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { useLang, t } from '@/lib/use-lang';

type DeletionStatus = {
  deletionRequested: boolean;
  status: 'pending' | 'cancelled' | 'completed' | null;
  scheduledHardDeleteAt: string | null;
};

export function PrivacyPage() {
  const lang = useLang();
  const [tracking, setTracking] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('goblin-tracking-opt-out') !== 'true';
  });
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      try {
        const r = await fetch(`${apiBase}/api/account/deletion-status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (r.ok) setDeletionStatus(await r.json());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function toggleTracking(v: boolean) {
    // v = "anonymous usage data ON". Opt-out is the inverse. setAnalyticsOptOut
    // persists the flag AND applies it live (stops/starts PostHog this session).
    setTracking(v);
    setAnalyticsOptOut(!v);
  }

  async function requestDeletion() {
    if (confirmText !== 'DELETE') return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg(t(lang, 'Nicht eingeloggt.', 'Not signed in.'));
        setSubmitting(false);
        return;
      }
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/account/request-deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      const body = await r.json();
      if (!r.ok) {
        setErrorMsg(body.error ?? t(lang, 'Fehler beim Beantragen der Löschung.', 'Failed to request deletion.'));
        setSubmitting(false);
        return;
      }
      // Soft-delete done; sign out and route to public page.
      await supabase.auth.signOut();
      window.location.href = '/deletion-pending';
    } catch {
      setErrorMsg(t(lang, 'Netzwerk-Fehler.', 'Network error.'));
      setSubmitting(false);
    }
  }

  const scheduled = deletionStatus?.scheduledHardDeleteAt
    ? new Date(deletionStatus.scheduledHardDeleteAt).toLocaleDateString('de-DE')
    : null;

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label={t(lang, 'Tracking', 'Tracking')}>
        <SettingsCard>
          <SettingsRow
            label={t(lang, 'Anonyme Nutzungsdaten', 'Anonymous usage data')}
            rightVariant="toggle"
            value={tracking}
            onChange={toggleTracking}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Daten', 'Data')}>
        <SettingsCard>
          <SettingsRow label={t(lang, 'Datenschutzerklärung', 'Privacy policy')} onClick={() => { window.location.href = '/privacy'; }} />
          <SettingsRow label={t(lang, 'Nutzungsbedingungen', 'Terms of service')} onClick={() => { window.location.href = '/terms'; }} />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Konto', 'Account')}>
        <SettingsCard>
          {deletionStatus?.deletionRequested && scheduled ? (
            <div style={{ padding: '14px 20px', fontSize: 'var(--t-small-fs)', color: 'var(--text)' }}>
              <div style={{ color: 'var(--rust)', fontWeight: 600, marginBottom: 4 }}>
                {t(lang, 'Löschung beantragt', 'Deletion requested')}
              </div>
              <div className="helper-text" style={{ color: 'var(--meta)' }}>
                {t(lang, `Konto wird am ${scheduled} unwiderruflich gelöscht. Check deine Email für den Abbruch-Link.`, `Account will be permanently deleted on ${scheduled}. Check your email for the cancellation link.`)}
              </div>
            </div>
          ) : (
            <SettingsRow
              label={t(lang, 'Konto löschen', 'Delete account')}
              labelColor="var(--rust)"
              rightVariant="chevron"
              onClick={() => { setShowConfirm(true); setConfirmText(''); setErrorMsg(''); }}
            />
          )}
        </SettingsCard>
      </SettingsGroup>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div style={{
            background: 'var(--panel)',
            padding: 24,
            borderRadius: 'var(--radius-lg)',
            maxWidth: 480,
            width: '100%',
            fontFamily: 'var(--font-sans)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, margin: '0 0 12px' }}>
              {t(lang, 'Konto wirklich löschen?', 'Really delete account?')}
            </h3>
            <p style={{ color: 'var(--meta)', fontSize: 'var(--t-small-fs)', margin: '0 0 16px' }}>
              {t(lang,
                'Diese Aktion startet eine 30-Tage-Wartezeit. Während dieser Zeit kannst du dich nicht einloggen. Nach 30 Tagen werden alle deine Daten unwiderruflich gelöscht. Du erhältst eine Email mit einem Link zum Abbruch.',
                'This action starts a 30-day waiting period. During this time you cannot log in. After 30 days all your data will be permanently deleted. You will receive an email with a cancellation link.'
              )}
            </p>
            <p style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, margin: '0 0 8px' }}>
              {t(lang, 'Tippe ', 'Type ')}<code>DELETE</code>{t(lang, ' zum Bestätigen:', ' to confirm:')}
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--div)',
                borderRadius: 8,
                fontSize: 'var(--t-body-fs)',
                background: 'var(--white)',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />
            {errorMsg && (
              <p style={{ color: 'var(--rust)', fontSize: 13, margin: '0 0 12px' }}>{errorMsg}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                disabled={submitting}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--div)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {t(lang, 'Abbrechen', 'Cancel')}
              </button>
              <button
                onClick={requestDeletion}
                disabled={confirmText !== 'DELETE' || submitting}
                style={{
                  padding: '10px 16px',
                  background: confirmText === 'DELETE' ? 'var(--rust)' : 'rgba(0,0,0,0.10)',
                  color: confirmText === 'DELETE' ? '#fff' : 'var(--meta)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: confirmText === 'DELETE' && !submitting ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {submitting ? t(lang, 'Beantrage…', 'Requesting…') : t(lang, 'Löschen beantragen', 'Request deletion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
