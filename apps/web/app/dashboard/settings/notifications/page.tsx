'use client';
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.

import { useState } from 'react';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellSlash, Envelope, ChatCircle } from '@phosphor-icons/react';

const CARD_STYLE = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '28px 28px 24px',
  marginBottom: 20,
};

function ToggleRow({ Icon, title, description, enabled, onToggle, disabled, badge }: {
  Icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '14px 0', borderBottom: '1px solid var(--div)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: enabled ? 'rgba(45,74,43,0.08)' : 'var(--subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} weight="duotone" color={enabled ? 'var(--brand-green)' : 'var(--meta)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'var(--meta)',
              background: 'var(--subtle)', padding: '1px 7px', borderRadius: 4,
              letterSpacing: '0.04em',
            }}>{badge}</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--meta)', lineHeight: 1.5, margin: 0 }}>{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label={`Toggle ${title}`}
        style={{
          position: 'relative', display: 'inline-block', width: 40, height: 22,
          flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer',
          border: 'none', background: 'transparent', padding: 0, marginTop: 6,
        }}
      >
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 11,
          background: enabled ? 'var(--brand-green)' : 'var(--border)',
          transition: 'background 0.2s',
          opacity: disabled ? 0.5 : 1,
        }} />
        <div style={{
          position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18,
          borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const { subscribe, unsubscribe, isSubscribed, isSupported, loading } = usePushNotifications();
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [emailSecurity, setEmailSecurity] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handlePushToggle = async () => {
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

  return (
    <SettingsLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, color: 'var(--brand-green)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          Notifications
        </h1>
        <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
          Choose how Goblin lets you know about builds, deploys, and updates.
        </p>
      </div>

      {/* Push */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 17, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Browser & Push
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 14 }}>
          Get notified when long builds finish — even when Goblin is not in focus.
        </p>

        {!isSupported && !loading ? (
          <div style={{ padding: '10px 14px', background: 'var(--subtle)', borderRadius: 8, fontSize: 12, color: 'var(--meta)' }}>
            Push notifications are not supported in this browser.
          </div>
        ) : (
          <>
            <ToggleRow
              Icon={isSubscribed ? Bell : BellSlash}
              title="Build complete"
              description="Notify me when a build or deploy finishes (success or failure)."
              enabled={isSubscribed}
              onToggle={handlePushToggle}
              disabled={loading}
            />
            {isSubscribed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <button
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  style={{
                    background: 'transparent', color: 'var(--brand-green)',
                    border: '1.5px solid var(--border)', borderRadius: 8,
                    padding: '8px 14px', fontSize: 12, fontWeight: 500,
                    cursor: sendingTest ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {sendingTest ? 'Sending…' : 'Send test notification'}
                </button>
                {testResult && (
                  <span style={{ fontSize: 12, color: testResult.startsWith('✓') ? 'var(--good)' : 'var(--danger)' }}>
                    {testResult}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Email */}
      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 17, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Email
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 8 }}>
          What lands in your inbox.
        </p>

        <ToggleRow
          Icon={Envelope}
          title="Security alerts"
          description="New sign-ins, password changes, and API key activity. Recommended on."
          enabled={emailSecurity}
          onToggle={() => setEmailSecurity(s => !s)}
        />
        <ToggleRow
          Icon={ChatCircle}
          title="Product updates"
          description="New features, model availability, and changelog highlights — at most weekly."
          enabled={emailUpdates}
          onToggle={() => setEmailUpdates(s => !s)}
        />
        <ToggleRow
          Icon={Envelope}
          title="Billing receipts"
          description="Stripe sends these automatically. Cannot be disabled."
          enabled
          onToggle={() => {}}
          disabled
          badge="Required"
        />
      </div>
    </SettingsLayout>
  );
}
