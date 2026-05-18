'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';

type DeletionStatus = {
  deletionRequested: boolean;
  status: 'pending' | 'cancelled' | 'completed' | null;
  scheduledHardDeleteAt: string | null;
};

export function PrivacyPage() {
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
    setTracking(v);
    localStorage.setItem('goblin-tracking-opt-out', v ? 'false' : 'true');
  }

  async function downloadData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    const r = await fetch(`${apiBase}/api/users/me/export`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goblin-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function requestDeletion() {
    if (confirmText !== 'DELETE') return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg('Nicht eingeloggt.');
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
        setErrorMsg(body.error ?? 'Fehler beim Beantragen der Löschung.');
        setSubmitting(false);
        return;
      }
      // Soft-delete done; sign out and route to public page.
      await supabase.auth.signOut();
      window.location.href = '/deletion-pending';
    } catch {
      setErrorMsg('Netzwerk-Fehler.');
      setSubmitting(false);
    }
  }

  const scheduled = deletionStatus?.scheduledHardDeleteAt
    ? new Date(deletionStatus.scheduledHardDeleteAt).toLocaleDateString('de-DE')
    : null;

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-ui)' }}>
      <SettingsGroup label="Tracking">
        <SettingsCard>
          <SettingsRow
            label="Anonyme Nutzungsdaten"
            rightVariant="toggle"
            value={tracking}
            onChange={toggleTracking}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Daten">
        <SettingsCard>
          <SettingsRow label="Meine Daten exportieren" onClick={downloadData} />
          <SettingsRow label="Datenschutzerklärung" onClick={() => { window.location.href = '/privacy'; }} />
          <SettingsRow label="Nutzungsbedingungen" onClick={() => { window.location.href = '/terms'; }} />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Konto">
        <SettingsCard>
          {deletionStatus?.deletionRequested && scheduled ? (
            <div style={{ padding: '14px 20px', fontSize: 14, color: 'var(--text)' }}>
              <div style={{ color: 'var(--rust)', fontWeight: 600, marginBottom: 4 }}>
                Löschung beantragt
              </div>
              <div style={{ color: 'var(--meta)' }}>
                Konto wird am {scheduled} unwiderruflich gelöscht. Check deine Email für den Abbruch-Link.
              </div>
            </div>
          ) : (
            <SettingsRow
              label="Konto löschen"
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
            fontFamily: 'var(--font-ui)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-brand)', fontSize: 22, margin: '0 0 12px' }}>
              Konto wirklich löschen?
            </h3>
            <p style={{ color: 'var(--meta)', fontSize: 14, margin: '0 0 16px' }}>
              Diese Aktion startet eine 30-Tage-Wartezeit. Während dieser Zeit kannst du dich nicht
              einloggen. Nach 30 Tagen werden alle deine Daten unwiderruflich gelöscht. Du erhältst
              eine Email mit einem Link zum Abbruch.
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              Tippe <code>DELETE</code> zum Bestätigen:
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
                fontSize: 16,
                background: 'var(--white)',
                color: 'var(--text)',
                fontFamily: 'var(--font-ui)',
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
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Abbrechen
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
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {submitting ? 'Beantrage…' : 'Löschen beantragen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
