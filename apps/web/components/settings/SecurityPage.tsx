'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

export function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 12 && passwordsMatch && !submitting;

  async function submit() {
    setErrorMsg('');
    if (newPassword.length < 12) {
      setErrorMsg('Neues Passwort: mindestens 12 Zeichen.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMsg('Neue Passwörter stimmen nicht überein.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg('Nicht eingeloggt.');
        setSubmitting(false);
        return;
      }
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/account/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrorMsg(body.error ?? 'Fehler beim Ändern.');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
      }, 2000);
    } catch {
      setErrorMsg('Netzwerk-Fehler.');
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <h2 style={{ color: 'var(--brand-green)', fontFamily: 'var(--font-sans)', margin: '0 0 8px' }}>
          Passwort geändert
        </h2>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--t-small-fs)' }}>
          Du wirst zum Login weitergeleitet…
        </p>
      </div>
    );
  }

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Passwort ändern">
        <SettingsCard>
          <PasswordField
            label="Aktuelles Passwort"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            label="Neues Passwort"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            hint="Mindestens 12 Zeichen, mit Groß-/Kleinbuchstaben und Zahl."
          />
          <PasswordField
            label="Neues Passwort bestätigen"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </SettingsCard>
      </SettingsGroup>

      {errorMsg && (
        <p style={{ color: 'var(--rust)', fontSize: 'var(--t-small-fs)', margin: '12px 4px' }}>{errorMsg}</p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          width: '100%',
          padding: 16,
          marginTop: 12,
          background: canSubmit ? 'var(--brand-green)' : 'rgba(0,0,0,0.10)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 17,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Ändere…' : 'Passwort ändern'}
      </button>

      <p style={{ color: 'var(--meta)', fontSize: 'var(--t-caption-fs)', marginTop: 16, padding: '0 4px' }}>
        Nach der Änderung wirst du auf allen Geräten abgemeldet und musst dich neu einloggen.
      </p>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div style={{ padding: '12px 20px', minHeight: 64, display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: 13, color: 'var(--meta)' }}>{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 'var(--t-body-fs)',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          marginTop: 4,
          padding: 0,
          width: '100%',
        }}
      />
      {hint && (
        <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', marginTop: 4 }}>{hint}</span>
      )}
    </div>
  );
}
