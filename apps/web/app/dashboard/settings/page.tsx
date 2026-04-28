'use client';
import { useState } from 'react';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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

function NotificationsSection() {
  const { subscribe, unsubscribe, isSubscribed, isSupported, loading } = usePushNotifications();
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/notifications/test`, {
        method: 'POST',
      });
      if (res.ok) {
        setTestResult('✓ Test notification sent!');
      } else {
        setTestResult('✗ Failed to send test notification');
      }
    } catch {
      setTestResult('✗ Failed to send test');
    } finally {
      setSendingTest(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  if (!isSupported && !loading) return null;

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14, padding: '28px 28px 24px',
      marginBottom: 20,
    }}>
      <h2 style={{
        fontFamily: 'Fraunces, serif', fontSize: 22,
        color: 'var(--moss)', fontWeight: 700,
        marginBottom: 4, letterSpacing: '-0.5px',
      }}>🔔 Build Notifications</h2>
      <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>
        Get notified when builds complete
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={handleToggle}
          disabled={loading}
          style={{
            background: isSubscribed ? 'var(--good)' : 'var(--moss)',
            color: '#fff',
            border: 'none', borderRadius: 8,
            padding: '10px 22px', fontSize: 13, fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : isSubscribed ? '✓ Enabled' : 'Enable'}
        </button>

        {isSubscribed && (
          <button
            onClick={handleSendTest}
            disabled={sendingTest}
            style={{
              background: 'transparent',
              color: 'var(--meta)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '9px 18px',
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

export default function SettingsPage() {
  return (
    <SettingsLayout>
      {/* Notifications section */}
      <NotificationsSection />

      {/* General card */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14, padding: '28px 28px 24px',
        marginBottom: 20,
      }}>
        <h2 style={{
          fontFamily: 'Fraunces, serif', fontSize: 22,
          color: 'var(--moss)', fontWeight: 700,
          marginBottom: 4, letterSpacing: '-0.5px',
        }}>General</h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 28 }}>
          Your account preferences
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              Display Name
            </label>
            <input
              type="text"
              defaultValue="Vince"
              style={FIELD_STYLE}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              style={FIELD_STYLE}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <p style={{ fontSize: 12, color: 'var(--meta)', marginTop: 5, fontWeight: 300 }}>
              Changing your email will trigger a confirmation link.
            </p>
          </div>

          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{
                background: 'var(--moss)', color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '10px 22px', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                transition: 'background 0.15s', minHeight: 40,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid rgba(184,92,60,0.25)',
        borderRadius: 14, padding: '24px 28px',
      }}>
        <h3 style={{
          fontFamily: 'Fraunces, serif', fontSize: 16,
          color: 'var(--danger)', fontWeight: 700, marginBottom: 6,
        }}>Danger zone</h3>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 16, fontWeight: 300 }}>
          Irreversible actions. Be careful.
        </p>
        <button
          style={{
            background: 'transparent', color: 'var(--danger)',
            border: '1.5px solid rgba(184,92,60,0.4)',
            borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
            minHeight: 40,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(184,92,60,0.06)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(184,92,60,0.4)'; }}
        >
          Delete account
        </button>
      </div>
    </SettingsLayout>
  );
}
