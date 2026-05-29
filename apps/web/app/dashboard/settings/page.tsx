'use client';
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL access only.
// Do not extend; future settings additions belong in SettingsRoot
// (apps/web/components/settings/SettingsRoot.tsx).
import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const FIELD_STYLE = {
  width: '100%',
  height: 48,
  padding: '0 14px',
  borderRadius: 9,
  border: '1.5px solid var(--border)',
  background: 'var(--panel)',
  color: 'var(--text)',
  fontSize: 16,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box' as const,
};

const CARD_STYLE = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '28px 28px 24px',
  marginBottom: 20,
};

function AdvancedModeSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/users/me`)
      .then(r => r.json())
      .then(d => { if (typeof d.advanced_mode === 'boolean') setEnabled(d.advanced_mode); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    setSaving(true);
    const next = !enabled;
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ advanced_mode: next }),
      });
      setEnabled(next);
      toast.success(next ? 'Advanced mode enabled.' : 'Advanced mode disabled.');
    } catch {
      toast.error('Failed to save preference.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
            Advanced Mode
          </h2>
          <p style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6 }}>
            Unlock developer tools: token counts, model latency, custom LiteLLM config, per-project routing,
            file-tree hidden files, and more. No impact on default-mode users.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading || saving}
          aria-label="Toggle advanced mode"
          style={{
            position: 'relative', display: 'inline-block', width: 44, height: 24,
            flexShrink: 0, cursor: loading || saving ? 'not-allowed' : 'pointer',
            border: 'none', background: 'transparent', padding: 0, marginTop: 2,
          }}
        >
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: enabled ? 'var(--brand-green)' : 'var(--border)',
            transition: 'background 0.2s',
          }} />
          <div style={{
            position: 'absolute', top: 2, left: enabled ? 22 : 2, width: 20, height: 20,
            borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
    </div>
  );
}

function GeneralTab() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? '');
        const name = data.user.user_metadata?.display_name
          ?? data.user.user_metadata?.full_name
          ?? data.user.email?.split('@')[0]
          ?? '';
        setDisplayName(name);
      }
    });
  }, []);

  const avatarInitial = displayName?.[0]?.toUpperCase() ?? userEmail?.[0]?.toUpperCase() ?? '?';

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (error) throw error;
      toast.success('Profile saved.');
      setProfileDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      {/* Profile card */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Profile
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 24 }}>Your account information</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--brand-green)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700,
            flexShrink: 0,
          }}>{avatarInitial}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{displayName || userEmail}</div>
            <div style={{ fontSize: 13, color: 'var(--meta)' }}>{userEmail}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setProfileDirty(true); }}
              style={FIELD_STYLE}
              onFocus={e => (e.target.style.borderColor = 'var(--brand-green)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={userEmail}
              readOnly
              style={{ ...FIELD_STYLE, background: 'var(--subtle)', color: 'var(--meta)', cursor: 'default' }}
            />
            <p style={{ fontSize: 12, color: 'var(--meta)', marginTop: 5, fontWeight: 300 }}>
              Email cannot be changed here. Contact support if needed.
            </p>
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={saveProfile}
              disabled={savingProfile || !profileDirty}
              style={{
                background: profileDirty ? 'var(--brand-green)' : 'var(--subtle)',
                color: profileDirty ? '#fff' : 'var(--meta)',
                border: 'none', borderRadius: 8,
                padding: '10px 22px', fontSize: 13, fontWeight: 500,
                cursor: savingProfile || !profileDirty ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)', minHeight: 40,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (profileDirty) e.currentTarget.style.background = 'var(--green-600)'; }}
              onMouseLeave={e => { if (profileDirty) e.currentTarget.style.background = 'var(--brand-green)'; }}
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Mode */}
      <AdvancedModeSection />

      {/* Danger zone */}
      <div style={{ ...CARD_STYLE, border: '1px solid rgba(184,92,60,0.25)' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--danger)', fontWeight: 700, marginBottom: 6 }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 16, fontWeight: 300 }}>
          Irreversible actions. Proceed with caution.
        </p>
        {showDeleteConfirm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380 }}>
            <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
              This will permanently delete your account and all data. Type DELETE to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              style={{ ...FIELD_STYLE, height: 40, fontSize: 13, border: '1.5px solid rgba(184,92,60,0.4)' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Cancel
              </button>
              <button
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Delete Account
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              background: 'transparent', color: 'var(--danger)',
              border: '1.5px solid rgba(184,92,60,0.4)',
              borderRadius: 8, padding: '9px 18px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', minHeight: 40,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(184,92,60,0.06)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(184,92,60,0.4)'; }}
          >
            Delete account
          </button>
        )}
      </div>
    </>
  );
}

interface ModelOption { slug: string; label: string; }

const BYOK_MODELS: ModelOption[] = [
  { slug: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Anthropic)' },
  { slug: 'anthropic/claude-opus-4-5',   label: 'Claude Opus 4.5 (Anthropic)' },
  { slug: 'anthropic/claude-haiku-4-5',  label: 'Claude Haiku 4.5 (Anthropic)' },
  { slug: 'openai/gpt-4o',               label: 'GPT-4o (OpenAI)' },
  { slug: 'openai/gpt-4o-mini',          label: 'GPT-4o Mini (OpenAI)' },
  { slug: 'openai/o1',                   label: 'o1 (OpenAI)' },
  { slug: 'openai/o3-mini',              label: 'o3-mini (OpenAI)' },
  { slug: 'gemini/gemini-2.0-flash',     label: 'Gemini 2.0 Flash (Google)' },
  { slug: 'gemini/gemini-1.5-pro',       label: 'Gemini 1.5 Pro (Google)' },
  { slug: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
  { slug: 'groq/mixtral-8x7b-32768',     label: 'Mixtral 8x7B (Groq)' },
  { slug: 'deepseek/deepseek-chat',      label: 'DeepSeek V3' },
  { slug: 'deepseek/deepseek-reasoner',  label: 'DeepSeek R1' },
  { slug: 'mistral/mistral-large-latest', label: 'Mistral Large' },
  { slug: 'xai/grok-3',                  label: 'Grok 3 (xAI)' },
  { slug: 'free/gemini-flash',           label: 'Gemini Flash (Free)' },
  { slug: 'free/llama-70b',              label: 'Llama 3.3 70B (Free)' },
];

function DefaultModelDropdown({
  label, description, value, onChange, saving,
}: {
  label: string; description: string; value: string; onChange: (v: string) => void; saving: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
        {label}
      </label>
      <p style={{ fontSize: 12, color: 'var(--meta)', marginBottom: 8 }}>{description}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={saving}
        style={{ ...FIELD_STYLE, cursor: 'pointer', height: 44 }}
        onFocus={e => (e.target.style.borderColor = 'var(--brand-green)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      >
        <option value="">— Auto (use connected key) —</option>
        {BYOK_MODELS.map(m => <option key={m.slug} value={m.slug}>{m.label}</option>)}
      </select>
    </div>
  );
}

function DeveloperTab() {
  const [defaultChatModel, setDefaultChatModel] = useState('');
  const [defaultCodeModel, setDefaultCodeModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [timeoutSetting, setTimeoutSetting] = useState('30');
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/users/me`, { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json())
      .then(d => {
        if (d.default_chat_model) setDefaultChatModel(d.default_chat_model as string);
        if (d.default_code_model) setDefaultCodeModel(d.default_code_model as string);
      })
      .catch(() => {});
  }, []);

  const saveModels = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          default_chat_model: defaultChatModel || null,
          default_code_model: defaultCodeModel || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* Default Models */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Default Models
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Per-use-case defaults. Only models with a connected key will work.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 16 }}>
          <DefaultModelDropdown
            label="Default Chat Model"
            description="Used for all chat conversations unless overridden."
            value={defaultChatModel}
            onChange={setDefaultChatModel}
            saving={saving}
          />
          <DefaultModelDropdown
            label="Default Code Model"
            description="Used when generating or editing code."
            value={defaultCodeModel}
            onChange={setDefaultCodeModel}
            saving={saving}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={saveModels}
            disabled={saving}
            style={{
              background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 22px', fontSize: 13, fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', minHeight: 40, opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!saving) (e.currentTarget.style.background = 'var(--green-600)'); }}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand-green)')}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saved && <span style={{ fontSize: 13, color: 'var(--good)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Request Timeout */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Request Timeout
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Max wait time per AI request</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {['10', '30', '60', '120'].map(t => (
            <button
              key={t}
              onClick={() => setTimeoutSetting(t)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: timeoutSetting === t ? '2px solid var(--brand-green)' : '1.5px solid var(--border)',
                background: timeoutSetting === t ? 'rgba(45,74,43,0.08)' : 'transparent',
                color: timeoutSetting === t ? 'var(--brand-green)' : 'var(--meta)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      {/* System Prompt Override */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          System Prompt Override
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>
          Prepended to every chat. Leave empty to use the default system prompt.
        </p>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful coding assistant..."
          rows={5}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 9,
            border: '1.5px solid var(--border)', background: 'var(--panel)',
            color: 'var(--text)', fontSize: 14, fontFamily: 'JetBrains Mono, monospace',
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            lineHeight: 1.6,
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--brand-green)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            style={{
              background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 22px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', minHeight: 40,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-600)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand-green)')}
          >
            Save
          </button>
        </div>
      </div>

      {/* Export Data */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Export Data
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Download all your projects, chats, and settings as JSON</p>
        <button
          style={{
            background: 'transparent', color: 'var(--brand-green)',
            border: '1.5px solid var(--brand-green)',
            borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', minHeight: 40,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Export all my data (JSON)
        </button>
      </div>

      {/* Coming soon: API Access + Webhook */}
      <div style={{ ...CARD_STYLE, opacity: 0.5, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.3px' }}>
            API Access & Webhooks
          </h2>
          <span style={{ fontSize: 11, background: 'var(--border)', color: 'var(--meta)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
            Phase 4
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--meta)' }}>Programmatic access and webhook integrations coming soon.</p>
      </div>
    </>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'general' | 'developer'>('general');

  // Read ?tab=developer from URL to show developer tools directly
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'developer') setTab('developer');
  }, []);

  const tabStyle = (active: boolean) => ({
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500 as const,
    border: 'none', cursor: 'pointer' as const,
    background: active ? 'var(--brand-green)' : 'transparent',
    color: active ? '#fff' : 'var(--meta)',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  });

  return (
    <SettingsLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, color: 'var(--brand-green)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          {tab === 'developer' ? 'Developer Tools' : 'Profile & Account'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
          {tab === 'developer'
            ? 'Advanced model settings, system prompt, and developer preferences.'
            : 'Manage your profile, appearance, and notifications.'}
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px',
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 11, marginBottom: 28, width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'general')} onClick={() => setTab('general')}>Account</button>
        <button style={tabStyle(tab === 'developer')} onClick={() => setTab('developer')}>Developer</button>
      </div>

      {tab === 'general' ? <GeneralTab /> : <DeveloperTab />}
    </SettingsLayout>
  );
}
