'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

export function PersonalizationPage() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setDisplayName(user.user_metadata?.full_name ?? '');
      setUsername(user.user_metadata?.username ?? '');
      setBio(user.user_metadata?.bio ?? '');
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { full_name: displayName, username, bio },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'var(--font-ui)',
    outline: 'none',
  };

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-ui)' }}>
      <SettingsGroup label="Profil">
        <SettingsCard>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Anzeigename">
              <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Vincent Hafner" />
            </Field>
            <Field label="Username">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-meta)', paddingLeft: 14, paddingRight: 4 }}>@</span>
                <input style={{ ...inputStyle, paddingLeft: 0 }} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="vincent" />
              </div>
            </Field>
            <Field label="Bio (optional)">
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Was baust du?" maxLength={200} />
            </Field>
          </div>
        </SettingsCard>
      </SettingsGroup>

      <button onClick={save} disabled={saving} style={{
        marginTop: 16, width: '100%', padding: 14,
        background: 'var(--moss)', color: '#fff', border: 'none',
        borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 600,
        cursor: saving ? 'wait' : 'pointer',
        fontFamily: 'var(--font-ui)',
      }}>
        {saved ? 'Gespeichert ✓' : saving ? 'Speichere…' : 'Speichern'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--text-meta)', marginTop: 16, padding: '0 4px' }}>
        Avatar-Upload kommt bald.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
