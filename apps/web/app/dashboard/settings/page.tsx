'use client';
import { useState } from 'react';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme, type Theme } from '@/lib/theme';

const FIELD_STYLE = {
  width: '100%',
  height: 48,
  padding: '0 14px',
  borderRadius: 9,
  border: '1.5px solid var(--border)',
  background: '#fff',
  color: 'var(--text)',
  fontSize: 16,
  fontFamily: 'DM Sans, sans-serif',
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

function NotificationsSection() {
  const { subscribe, unsubscribe, isSubscribed, isSupported, loading } = usePushNotifications();
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleToggle = async () => {
    if (isSubscribed) await unsubscribe();
    else await subscribe();
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notifications/test`, { method: 'POST' });
      setTestResult(res.ok ? '✓ Test notification sent!' : '✗ Failed to send test notification');
    } catch {
      setTestResult('✗ Failed to send test');
    } finally {
      setSendingTest(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  if (!isSupported && !loading) return null;

  return (
    <div style={CARD_STYLE}>
      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
        Build Notifications
      </h2>
      <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Get notified when builds complete</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={handleToggle}
          disabled={loading}
          style={{
            background: isSubscribed ? 'var(--good)' : 'var(--moss)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '10px 22px',
            fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : isSubscribed ? '✓ Enabled' : 'Enable'}
        </button>
        {isSubscribed && (
          <button
            onClick={handleSendTest}
            disabled={sendingTest}
            style={{
              background: 'transparent', color: 'var(--meta)',
              border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px',
              fontSize: 13, fontWeight: 500, cursor: sendingTest ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {sendingTest ? 'Sending...' : 'Send test'}
          </button>
        )}
      </div>
      {testResult && (
        <p style={{ fontSize: 12, color: testResult.startsWith('✓') ? 'var(--good)' : 'var(--danger)', marginTop: 8 }}>
          {testResult}
        </p>
      )}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark',  label: 'Dark',  icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' },
  ];
  return (
    <div style={CARD_STYLE}>
      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
        Appearance
      </h2>
      <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Theme and display preferences</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map(opt => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: isActive ? '2px solid var(--moss)' : '1.5px solid var(--border)',
                background: isActive ? 'rgba(45,74,43,0.1)' : 'transparent',
                color: isActive ? 'var(--moss)' : 'var(--meta)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GeneralTab() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      {/* Profile card */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Profile
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 24 }}>Your account information</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--moss)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700,
            flexShrink: 0,
          }}>V</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Vince</div>
            <div style={{ fontSize: 13, color: 'var(--meta)' }}>vinc.hafner@gmail.com</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              Display Name
            </label>
            <input
              type="text" defaultValue="Vince" style={FIELD_STYLE}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email" defaultValue="vinc.hafner@gmail.com"
              readOnly style={{ ...FIELD_STYLE, background: '#f7f5f2', color: 'var(--meta)', cursor: 'default' }}
            />
            <p style={{ fontSize: 12, color: 'var(--meta)', marginTop: 5, fontWeight: 300 }}>
              Email is set by your OAuth provider and cannot be changed here.
            </p>
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{
                background: 'var(--moss)', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 22px', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', minHeight: 40,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>

      {/* Appearance card */}
      <AppearanceSection />

      {/* Notifications */}
      <NotificationsSection />

      {/* Danger zone */}
      <div style={{ ...CARD_STYLE, border: '1px solid rgba(184,92,60,0.25)' }}>
        <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: 'var(--danger)', fontWeight: 700, marginBottom: 6 }}>
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
              type="text" placeholder="Type DELETE to confirm"
              style={{ ...FIELD_STYLE, height: 40, fontSize: 13, border: '1.5px solid rgba(184,92,60,0.4)' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Cancel
              </button>
              <button
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
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
              fontFamily: 'DM Sans, sans-serif', minHeight: 40,
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

const MODELS = [
  'Claude Sonnet 4.6 (Anthropic)',
  'Gemini 2.0 Flash (Google)',
  'GPT-4o (OpenAI)',
  'Llama 3.3 70B (Groq)',
  'DeepSeek V3',
];

function DeveloperTab() {
  const [defaultModel, setDefaultModel] = useState(MODELS[0]);
  const [timeoutSetting, setTimeoutSetting] = useState('30');
  const [systemPrompt, setSystemPrompt] = useState('');

  return (
    <>
      {/* Default Model */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Default Model
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Used for all new chats unless overridden per-chat</p>
        <select
          value={defaultModel}
          onChange={e => setDefaultModel(e.target.value)}
          style={{ ...FIELD_STYLE, cursor: 'pointer', height: 44 }}
          onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        >
          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Request Timeout */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
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
                border: timeoutSetting === t ? '2px solid var(--moss)' : '1.5px solid var(--border)',
                background: timeoutSetting === t ? 'rgba(45,74,43,0.08)' : 'transparent',
                color: timeoutSetting === t ? 'var(--moss)' : 'var(--meta)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      {/* System Prompt Override */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
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
            border: '1.5px solid var(--border)', background: '#fff',
            color: 'var(--text)', fontSize: 14, fontFamily: 'JetBrains Mono, monospace',
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            lineHeight: 1.6,
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            style={{
              background: 'var(--moss)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 22px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', minHeight: 40,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >
            Save
          </button>
        </div>
      </div>

      {/* Export Data */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Export Data
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Download all your projects, chats, and settings as JSON</p>
        <button
          style={{
            background: 'transparent', color: 'var(--moss)',
            border: '1.5px solid var(--moss)',
            borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', minHeight: 40,
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
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.3px' }}>
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

  const tabStyle = (active: boolean) => ({
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500 as const,
    border: 'none', cursor: 'pointer' as const,
    background: active ? 'var(--moss)' : 'transparent',
    color: active ? '#fff' : 'var(--meta)',
    fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.15s',
  });

  return (
    <SettingsLayout>
      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px',
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 11, marginBottom: 28, width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'general')} onClick={() => setTab('general')}>General</button>
        <button style={tabStyle(tab === 'developer')} onClick={() => setTab('developer')}>Developer</button>
      </div>

      {tab === 'general' ? <GeneralTab /> : <DeveloperTab />}
    </SettingsLayout>
  );
}
