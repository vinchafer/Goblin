'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';

interface Prefs {
  custom_instructions: string | null;
  notify_build_complete: boolean;
  notify_important_updates: boolean;
  notify_email: boolean;
  memory_enabled: boolean;
}

export function PersonalizationPage() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({
    custom_instructions: '',
    notify_build_complete: true,
    notify_important_updates: true,
    notify_email: false,
    memory_enabled: false,
  });
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/account/preferences`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setPrefs({
          custom_instructions: data.custom_instructions ?? '',
          notify_build_complete: data.notify_build_complete ?? true,
          notify_important_updates: data.notify_important_updates ?? true,
          notify_email: data.notify_email ?? false,
          memory_enabled: data.memory_enabled ?? false,
        });
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { full_name: displayName, username, bio },
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        await fetch(`${apiBase}/api/account/preferences`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(prefs),
        });
      }
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
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
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

      <SettingsGroup label="Anweisungen für Goblin">
        <SettingsCard>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--text-meta)', marginBottom: 4, lineHeight: 1.5 }}>
              Wie soll Goblin mit dir arbeiten? Diese Anweisungen werden bei jedem Chat mitgegeben (zusätzlich zu projektspezifischen Anweisungen).
            </p>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
              value={prefs.custom_instructions ?? ''}
              onChange={(e) => setPrefs((p) => ({ ...p, custom_instructions: e.target.value }))}
              placeholder="z.B. Antworte präzise, schreibe Code mit ausführlichen Kommentaren, bevorzuge TypeScript…"
              maxLength={4000}
            />
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
              {(prefs.custom_instructions ?? '').length} / 4000
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Erinnerung">
        <SettingsCard>
          <SettingsRow
            label="Goblin darf sich Kontext aus Chats merken"
            rightVariant="toggle"
            value={prefs.memory_enabled}
            onChange={(v) => setPrefs((p) => ({ ...p, memory_enabled: v }))}
          />
        </SettingsCard>
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 8, padding: '0 4px', lineHeight: 1.5 }}>
          Memory-Verwaltung (was gemerkt wurde, einzelne Einträge löschen) folgt in einem kommenden Update.
        </p>
      </SettingsGroup>

      <SettingsGroup label="Benachrichtigungen">
        <SettingsCard>
          <SettingsRow
            label="Build abgeschlossen"
            rightVariant="toggle"
            value={prefs.notify_build_complete}
            onChange={(v) => setPrefs((p) => ({ ...p, notify_build_complete: v }))}
          />
          <SettingsRow
            label="Wichtige Updates"
            rightVariant="toggle"
            value={prefs.notify_important_updates}
            onChange={(v) => setPrefs((p) => ({ ...p, notify_important_updates: v }))}
          />
          <SettingsRow
            label="E-Mail-Benachrichtigungen"
            rightVariant="toggle"
            value={prefs.notify_email}
            onChange={(v) => setPrefs((p) => ({ ...p, notify_email: v }))}
          />
        </SettingsCard>
      </SettingsGroup>

      <button onClick={save} disabled={saving} style={{
        marginTop: 16, width: '100%', padding: 14,
        background: 'var(--brand-green)', color: '#fff', border: 'none',
        borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 600,
        cursor: saving ? 'wait' : 'pointer',
        fontFamily: 'var(--font-sans)',
      }}>
        {saved ? 'Gespeichert ✓' : saving ? 'Speichere…' : 'Speichern'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
