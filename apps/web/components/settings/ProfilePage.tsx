'use client';

import { useState, useEffect } from 'react';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { useUser } from '@/lib/hooks/useUser';
import { useSheetStack } from '../ui/SheetStack';
import { SecurityPage } from './SecurityPage';
import { PrivacyPage } from './PrivacyPage';
import { TwoFactorPage } from './TwoFactorPage';
import { SessionsPage } from './SessionsPage';
import { DecryptLogPage } from './DecryptLogPage';
import { AvatarUploader } from '../profile/AvatarUploader';
import { createClient } from '@/lib/supabase/client';

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
const TrashIcon = ({ color = 'currentColor' }: { color?: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;

export function ProfilePage() {
  const { user, updateProfile } = useUser();
  const { push } = useSheetStack();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState<'de' | 'en'>('de');
  const [timezone, setTimezone] = useState<string>('');
  const [loadedPrefs, setLoadedPrefs] = useState(false);

  useEffect(() => {
    setName(user.fullName ?? '');
    setDisplayName(user.displayName ?? '');
  }, [user.fullName, user.displayName]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        const r = await fetch(`${apiBase}/api/account/preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (r.ok) {
          const data = await r.json();
          if (data.locale === 'de' || data.locale === 'en') setLocale(data.locale);
          setTimezone(data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
      } finally {
        setLoadedPrefs(true);
      }
    })();
  }, []);

  const isDirty = name !== (user.fullName ?? '') || displayName !== (user.displayName ?? '');
  const initial = (name?.[0] ?? user.email?.[0] ?? 'V').toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName: name, displayName });
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        await fetch(`${apiBase}/api/account/preferences`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ locale, timezone: timezone || null }),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <div className="avatar-large" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 32px' }}>
        <AvatarUploader
          currentUrl={user.avatarUrl ?? null}
          fallbackInitial={initial}
          onUploadComplete={() => window.location.reload()}
        />
        <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{name || 'Vincent'}</div>
      </div>

      <SettingsGroup label="Konto">
        <SettingsCard>
          <FormReadOnly label="E-Mail-Adresse" value={user.email} testId="form-email" />
          <FormInput label="Vollständiger Name" value={name} onChange={setName} testId="form-name" />
          <FormInput label="Anzeigename" value={displayName} onChange={setDisplayName} testId="form-displayname" />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Region">
        <SettingsCard>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: 'var(--text-meta)' }}>Sprache</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'de' | 'en')}
              disabled={!loadedPrefs}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: 'var(--t-body-fs)', color: 'var(--text)', padding: 0, marginTop: 4,
                fontFamily: 'var(--font-sans)', appearance: 'none',
              }}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: 'var(--text-meta)' }}>Zeitzone</label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Zurich"
              disabled={!loadedPrefs}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: 'var(--t-body-fs)', color: 'var(--text)', padding: 0, marginTop: 4,
                fontFamily: 'var(--font-sans)', width: '100%',
              }}
            />
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Sicherheit">
        <SettingsCard>
          <SettingsRow icon={<KeyIcon />} label="Passwort ändern" onClick={() => push('security', <SecurityPage />, 'Passwort ändern')} />
          <SettingsRow icon={<ShieldIcon />} label="Zwei-Faktor-Authentifizierung" onClick={() => push('2fa', <TwoFactorPage />, 'Zwei-Faktor-Authentifizierung')} />
          <SettingsRow icon={<FingerprintIcon />} label="Passkeys" right="Bald" rightVariant="text" disabled />
          <SettingsRow icon={<DeviceIcon />} label="Aktive Sitzungen" onClick={() => push('sessions', <SessionsPage />, 'Aktive Sitzungen')} />
          <SettingsRow icon={<KeyIcon />} label="API-Key Aktivität" onClick={() => push('decrypt-log', <DecryptLogPage />, 'API-Key Aktivität')} />
        </SettingsCard>
      </SettingsGroup>

      {/* Honesty sprint: removed the "Verknüpfte Konten → GitHub" row. Its
          onClick was a dev placeholder `alert(...)`, not a real connect. GitHub
          (and Vercel) connect for real on the dedicated Konnektoren tab. */}

      <button
        disabled={!isDirty || saving}
        onClick={handleSave}
        data-testid="profile-save"
        style={{
          width: '100%',
          padding: 16,
          marginTop: 8,
          background: !isDirty || saving ? 'rgba(0,0,0,0.10)' : 'var(--brand-green)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 17,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
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
            onClick={() => push('privacy', <PrivacyPage />, 'Datenschutz')}
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
      <span style={{ fontSize: 'var(--t-body-fs)', color: 'var(--text)', marginTop: 4 }}>{value || '—'}</span>
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
          fontSize: 'var(--t-body-fs)',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          marginTop: 4,
          padding: 0,
          width: '100%',
        }}
      />
    </div>
  );
}
