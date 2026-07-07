'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resolveDisplayName } from '@/lib/display-name';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { useLang, t } from '@/lib/use-lang';

// Honesty sprint (F3): notification toggles moved out of here — they now live
// solely on the Benachrichtigungen tab, backed by the same server fields. This
// page owns only what's unique to it: custom instructions + memory.
interface Prefs {
  custom_instructions: string | null;
  memory_enabled: boolean;
  // F4.2 — "Wie Goblin arbeitet". All three are injected globally and provably
  // change behavior (probe 6.3); no placebo toggles.
  pref_address_name: string | null;
  pref_response_style: 'knapp' | 'ausfuehrlich' | null;
  pref_explain_changes: boolean;
}

export function PersonalizationPage() {
  const lang = useLang();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({
    custom_instructions: '',
    memory_enabled: false,
    pref_address_name: '',
    pref_response_style: null,
    pref_explain_changes: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // FIX3-4: same canonical resolution as the pill/ProfileCard so the name shown
      // here matches everywhere (no more "Vincent 418" vs "Vincent 286").
      setDisplayName(resolveDisplayName(user.user_metadata, user.email));
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
          memory_enabled: data.memory_enabled ?? false,
          pref_address_name: data.pref_address_name ?? '',
          pref_response_style: data.pref_response_style ?? null,
          pref_explain_changes: data.pref_explain_changes ?? true,
        });
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      // FIX3-4: write the canonical field (display_name) the resolver reads first,
      // and keep full_name aligned, so the edit shows consistently everywhere.
      await supabase.auth.updateUser({
        data: { display_name: displayName, full_name: displayName, username, bio },
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
      <SettingsGroup label={t(lang, 'Profil', 'Profile')}>
        <SettingsCard>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t(lang, 'Anzeigename', 'Display name')}>
              <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Vincent Hafner" />
            </Field>
            <Field label={t(lang, 'Username', 'Username')}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-meta)', paddingLeft: 14, paddingRight: 4 }}>@</span>
                <input style={{ ...inputStyle, paddingLeft: 0 }} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="vincent" />
              </div>
            </Field>
            <Field label={t(lang, 'Bio (optional)', 'Bio (optional)')}>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t(lang, 'Was baust du?', 'What are you building?')} maxLength={200} />
            </Field>
          </div>
        </SettingsCard>
      </SettingsGroup>

      {/* F4.2 — Wie Goblin arbeitet: Anrede, Antwortstil, Erklärtiefe. All three
          inject globally and provably change behavior (no placebo toggles). */}
      <SettingsGroup label={t(lang, 'Wie Goblin arbeitet', 'How Goblin works')}>
        <SettingsCard>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label={t(lang, 'Anrede / Name', 'Name / how to address you')}>
              <input
                style={inputStyle}
                value={prefs.pref_address_name ?? ''}
                onChange={(e) => setPrefs((p) => ({ ...p, pref_address_name: e.target.value }))}
                placeholder={t(lang, 'z. B. Vincent, oder „du"', 'e.g. Vincent, or "friend"')}
                maxLength={80}
              />
              <span style={{ fontSize: 12, color: 'var(--text-meta)', lineHeight: 1.4 }}>
                {t(lang, 'Goblin nutzt diesen Namen in Begrüßungen und Berichten.', 'Goblin uses this name in greetings and reports.')}
              </span>
            </Field>

            <Field label={t(lang, 'Antwortstil', 'Response style')}>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  ['knapp', t(lang, 'Knapp', 'Concise')],
                  ['ausfuehrlich', t(lang, 'Ausführlich', 'Detailed')],
                ] as const).map(([val, label]) => {
                  const active = prefs.pref_response_style === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, pref_response_style: active ? null : val }))}
                      aria-pressed={active}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
                        border: active ? '2px solid var(--brand-green)' : '1px solid var(--border-subtle)',
                        background: active ? 'rgba(45,74,43,0.06)' : 'var(--subtle)',
                        color: active ? 'var(--brand-green)' : 'var(--text)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-meta)', lineHeight: 1.4 }}>
                {t(lang, 'Knapp: das Nötigste zuerst. Ausführlich: mit Kontext und Begründung.', 'Concise: essentials first. Detailed: with context and rationale.')}
              </span>
            </Field>
          </div>
        </SettingsCard>
        <SettingsCard>
          <SettingsRow
            label={t(lang, 'Code-Änderungen erklären', 'Explain code changes')}
            rightVariant="toggle"
            value={prefs.pref_explain_changes}
            onChange={(v) => setPrefs((p) => ({ ...p, pref_explain_changes: v }))}
          />
        </SettingsCard>
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 8, padding: '0 4px', lineHeight: 1.5 }}>
          {t(lang,
            'An: Goblin erklärt bei Änderungen kurz das Warum (auch im Agent-Bericht). Aus: nur das Was.',
            'On: Goblin briefly explains the why on changes (including in the agent report). Off: just the what.')}
        </p>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Anweisungen für Goblin', 'Instructions for Goblin')}>
        <SettingsCard>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--text-meta)', marginBottom: 4, lineHeight: 1.5 }}>
              {t(lang,
                'Wie soll Goblin mit dir arbeiten? Diese Anweisungen werden bei jedem Chat mitgegeben (zusätzlich zu projektspezifischen Anweisungen).',
                'How should Goblin work with you? These instructions are included in every chat (in addition to project-specific instructions).'
              )}
            </p>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
              value={prefs.custom_instructions ?? ''}
              onChange={(e) => setPrefs((p) => ({ ...p, custom_instructions: e.target.value }))}
              placeholder={t(lang, 'z.B. Antworte präzise, schreibe Code mit ausführlichen Kommentaren, bevorzuge TypeScript…', 'e.g. Answer concisely, write code with detailed comments, prefer TypeScript…')}
              maxLength={4000}
            />
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
              {(prefs.custom_instructions ?? '').length} / 4000
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Erinnerung', 'Memory')}>
        <SettingsCard>
          <SettingsRow
            label={t(lang, 'Goblin darf sich Kontext aus Chats merken', 'Let Goblin remember context from chats')}
            rightVariant="toggle"
            value={prefs.memory_enabled}
            onChange={(v) => setPrefs((p) => ({ ...p, memory_enabled: v }))}
          />
        </SettingsCard>
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 8, padding: '0 4px', lineHeight: 1.5 }}>
          {t(lang,
            'Memory-Verwaltung (was gemerkt wurde, einzelne Einträge löschen) folgt in einem kommenden Update.',
            'Memory management (what was remembered, deleting individual entries) is coming in a future update.'
          )}
        </p>
      </SettingsGroup>

      <button onClick={save} disabled={saving} style={{
        marginTop: 16, width: '100%', padding: 14,
        background: 'var(--brand-green)', color: '#fff', border: 'none',
        borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 600,
        cursor: saving ? 'wait' : 'pointer',
        fontFamily: 'var(--font-sans)',
      }}>
        {saved ? t(lang, 'Gespeichert ✓', 'Saved ✓') : saving ? t(lang, 'Speichere…', 'Saving…') : t(lang, 'Speichern', 'Save')}
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
