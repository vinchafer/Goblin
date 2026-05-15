'use client';

import { useState, useEffect } from 'react';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { useUser } from '@/lib/hooks/useUser';

const Edit14 = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const KeyIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></svg>;
const ShieldIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l8 4v5a9 9 0 0 1-8 9 9 9 0 0 1-8-9V7l8-4z"/></svg>;
const FingerprintIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a9 9 0 0 0-9 9c0 1 0 3 1 5M21 12a9 9 0 0 0-9-9M12 7a5 5 0 0 0-5 5c0 2 0 4 1 6M17 12a5 5 0 0 0-5-5M12 11v6M9 19h6"/></svg>;
const DeviceIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="3" width="10" height="18" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>;
const GitHubIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3a3 3 0 0 0-1-2.3c3-.3 6-1.5 6-7a5.5 5.5 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.8s-1.2-.3-4 1.5a14 14 0 0 0-7 0c-2.8-1.8-4-1.5-4-1.5a5 5 0 0 0-.1 3.8A5.5 5.5 0 0 0 2 10c0 5.5 3 6.7 6 7a3 3 0 0 0-1 2.3V22"/></svg>;
const TrashIcon = ({ color = 'currentColor' }: { color?: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;

export function ProfilePage() {
  const { user, updateProfile } = useUser();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user.fullName ?? '');
    setDisplayName(user.displayName ?? '');
  }, [user.fullName, user.displayName]);

  const isDirty = name !== (user.fullName ?? '') || displayName !== (user.displayName ?? '');
  const initial = (name?.[0] ?? user.email?.[0] ?? 'V').toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName: name, displayName });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 32px' }}>
        <div style={{ position: 'relative' }}>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'var(--moss)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 600,
            }}>{initial}</span>
          )}
          <button
            aria-label="Avatar ändern (Bald)"
            disabled
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--text)',
              color: '#FFFFFF',
              border: '2px solid var(--cream)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            <Edit14 />
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{name || 'Vincent'}</div>
      </div>

      <SettingsGroup label="Konto">
        <SettingsCard>
          <FormReadOnly label="E-Mail-Adresse" value={user.email} testId="form-email" />
          <FormInput label="Vollständiger Name" value={name} onChange={setName} testId="form-name" />
          <FormInput label="Anzeigename" value={displayName} onChange={setDisplayName} testId="form-displayname" />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Sicherheit">
        <SettingsCard>
          <SettingsRow icon={<KeyIcon />} label="Passwort ändern" onClick={() => alert('In Arbeit — 9E')} />
          <SettingsRow icon={<ShieldIcon />} label="Zwei-Faktor-Authentifizierung" right="Bald" rightVariant="text" disabled />
          <SettingsRow icon={<FingerprintIcon />} label="Passkeys" right="Bald" rightVariant="text" disabled />
          <SettingsRow icon={<DeviceIcon />} label="Aktive Sitzungen" right="Bald" rightVariant="text" disabled />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Verknüpfte Konten">
        <SettingsCard>
          <SettingsRow
            icon={<GitHubIcon />}
            label="GitHub"
            right={user.githubConnected ? 'Verbunden' : 'Verbinden'}
            rightVariant="text"
            onClick={() => alert('GitHub-Connect läuft über Sub-Page (9E)')}
          />
        </SettingsCard>
      </SettingsGroup>

      <button
        disabled={!isDirty || saving}
        onClick={handleSave}
        data-testid="profile-save"
        style={{
          width: '100%',
          padding: 16,
          marginTop: 8,
          background: !isDirty || saving ? 'rgba(0,0,0,0.10)' : 'var(--moss)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 17,
          fontWeight: 600,
          fontFamily: 'var(--font-ui)',
          cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Speichert...' : 'Profil aktualisieren'}
      </button>

      <SettingsGroup label="Gefahrenzone">
        <SettingsCard>
          <SettingsRow
            icon={<TrashIcon color="var(--rust)" />}
            label="Konto löschen"
            labelColor="var(--rust)"
            rightVariant="chevron"
            onClick={() => alert('Konto-Löschen → 9E (braucht Confirm-Flow)')}
          />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

function FormReadOnly({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ padding: '12px 20px', minHeight: 64, display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 13, color: 'var(--text-meta)' }}>{label}</span>
      <span style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{value || '—'}</span>
    </div>
  );
}

function FormInput({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <div data-testid={testId} style={{ padding: '12px 20px', minHeight: 64, display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: 13, color: 'var(--text-meta)' }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 16,
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
          marginTop: 4,
          padding: 0,
          width: '100%',
        }}
      />
    </div>
  );
}
