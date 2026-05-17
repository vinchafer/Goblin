'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';

export function PrivacyPage() {
  const [tracking, setTracking] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('goblin-tracking-opt-out') !== 'true';
  });
  const [deleting, setDeleting] = useState(false);

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
    a.download = `goblin-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!confirm('Konto wirklich löschen? Alle Projekte, Chats und Daten werden permanent entfernt.')) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        await supabase.auth.signOut();
        window.location.href = '/';
      }
    } finally {
      setDeleting(false);
    }
  }

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
          <SettingsRow
            label={deleting ? 'Lösche…' : 'Konto löschen'}
            labelColor="var(--rust)"
            onClick={deleteAccount}
            disabled={deleting}
          />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
