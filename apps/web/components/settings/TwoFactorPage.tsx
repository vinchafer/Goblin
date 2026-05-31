'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

type View = 'loading' | 'disabled' | 'qr' | 'recovery' | 'enabled';

interface Status {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
}

export function TwoFactorPage() {
  const [view, setView] = useState<View>('loading');
  const [status, setStatus] = useState<Status | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadStatus() {
    try {
      const r = await authedFetch('/api/auth/2fa/status');
      const data: Status = await r.json();
      setStatus(data);
      setView(data.enabled ? 'enabled' : 'disabled');
    } catch {
      setView('disabled');
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const startSetup = async () => {
    setError('');
    setSubmitting(true);
    try {
      const r = await authedFetch('/api/auth/2fa/setup-init', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Setup fehlgeschlagen');
        return;
      }
      setQrDataUrl(data.qrCodeDataUrl);
      setManualCode(data.manualEntryCode);
      setView('qr');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAndEnable = async () => {
    setError('');
    setSubmitting(true);
    try {
      const r = await authedFetch('/api/auth/2fa/setup-verify', {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Code ungültig');
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      setView('recovery');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCodes = () => {
    const text = `Goblin Recovery Codes\nGeneriert: ${new Date().toLocaleString('de-DE')}\n\n${recoveryCodes.join('\n')}\n\nJeder Code kann nur einmal verwendet werden.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goblin-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const disable2fa = async () => {
    const code = window.prompt('Aktuellen 6-stelligen TOTP-Code eingeben um 2FA zu deaktivieren:');
    if (!code) return;
    const r = await authedFetch('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (r.ok) {
      setView('disabled');
      setStatus({ enabled: false, enabledAt: null, recoveryCodesRemaining: 0 });
    } else {
      const data = await r.json().catch(() => ({}));
      alert(data.error ?? 'Fehler beim Deaktivieren');
    }
  };

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      {view === 'loading' && <p style={{ color: 'var(--meta)' }}>Lade…</p>}

      {view === 'disabled' && (
        <>
          <SettingsGroup label="Zwei-Faktor-Authentifizierung">
            <SettingsCard>
              <div style={{ padding: '14px 20px' }}>
                <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)', margin: '0 0 8px' }}>
                  Schütze dein Konto zusätzlich mit einem Code aus deiner Authenticator-App.
                  Besonders empfohlen wenn du BYOK-Keys hinterlegt hast.
                </p>
              </div>
            </SettingsCard>
          </SettingsGroup>
          {error && <p style={{ color: 'var(--rust)', fontSize: 13, margin: '8px 4px' }}>{error}</p>}
          <button
            onClick={startSetup}
            disabled={submitting}
            style={{
              width: '100%',
              padding: 16,
              marginTop: 12,
              background: submitting ? 'rgba(0,0,0,0.10)' : 'var(--brand-green)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: 17,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {submitting ? 'Lade…' : '2FA aktivieren'}
          </button>
        </>
      )}

      {view === 'qr' && (
        <div>
          <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)', margin: '0 0 12px' }}>
            <strong>1.</strong> Scanne den QR-Code mit Google Authenticator, Authy oder einer
            anderen TOTP-App.
          </p>
          <div style={{ textAlign: 'center', margin: '0 0 12px' }}>
            <img src={qrDataUrl} alt="QR Code" style={{ maxWidth: 220, width: '100%' }} />
          </div>
          <details style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--meta)' }}>
            <summary style={{ cursor: 'pointer' }}>QR-Code nicht scannen können?</summary>
            <p style={{ marginTop: 6 }}>
              Manuell eintragen:{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--subtle)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  wordBreak: 'break-all',
                }}
              >
                {manualCode}
              </code>
            </p>
          </details>

          <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)', margin: '0 0 8px' }}>
            <strong>2.</strong> Gib den 6-stelligen Code aus deiner App ein:
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            style={{
              width: '100%',
              padding: 12,
              fontSize: 22,
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
              letterSpacing: 6,
              border: '1px solid var(--div)',
              borderRadius: 10,
              marginBottom: 12,
              background: 'var(--panel)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
          {error && <p style={{ color: 'var(--rust)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>}
          <button
            onClick={verifyAndEnable}
            disabled={verifyCode.length !== 6 || submitting}
            style={{
              width: '100%',
              padding: 14,
              background: verifyCode.length === 6 && !submitting ? 'var(--brand-green)' : 'rgba(0,0,0,0.10)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 'var(--t-body-fs)',
              fontWeight: 600,
              cursor: verifyCode.length === 6 && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {submitting ? 'Verifiziere…' : 'Verifizieren & Aktivieren'}
          </button>
        </div>
      )}

      {view === 'recovery' && (
        <div>
          <h3 style={{ color: 'var(--brand-green)', fontFamily: 'var(--font-sans)', margin: '0 0 8px' }}>
            2FA aktiv
          </h3>
          <p style={{ fontSize: 'var(--t-small-fs)', margin: '0 0 12px' }}>
            <strong>Speichere diese Recovery-Codes jetzt.</strong> Sie werden nur einmal angezeigt.
            Mit ihnen kommst du in dein Konto, wenn du deinen Authenticator verlierst.
          </p>
          <div
            style={{
              background: 'var(--subtle)',
              border: '1px solid var(--div)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
            }}
          >
            {recoveryCodes.map((code) => (
              <div key={code} style={{ padding: '3px 0' }}>{code}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={downloadCodes}
              style={{
                flex: 1,
                padding: 12,
                background: 'var(--brand-green)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Als Datei speichern
            </button>
            <button
              onClick={() => void loadStatus()}
              style={{
                flex: 1,
                padding: 12,
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--div)',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Habe ich gespeichert
            </button>
          </div>
        </div>
      )}

      {view === 'enabled' && (
        <>
          <SettingsGroup label="Zwei-Faktor-Authentifizierung">
            <SettingsCard>
              <div style={{ padding: '14px 20px' }}>
                <p style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, color: 'var(--brand-green)', margin: '0 0 4px' }}>
                  2FA ist aktiv
                </p>
                {status?.enabledAt && (
                  <p style={{ fontSize: 13, color: 'var(--meta)', margin: 0 }}>
                    Aktiviert: {new Date(status.enabledAt).toLocaleDateString('de-DE')}
                  </p>
                )}
                <p style={{ fontSize: 13, color: 'var(--meta)', margin: '4px 0 0' }}>
                  Recovery-Codes übrig: {status?.recoveryCodesRemaining ?? 0} / 10
                </p>
              </div>
            </SettingsCard>
          </SettingsGroup>
          <button
            onClick={disable2fa}
            style={{
              width: '100%',
              padding: 14,
              marginTop: 12,
              background: 'transparent',
              color: 'var(--rust)',
              border: '1px solid var(--rust)',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            2FA deaktivieren
          </button>
        </>
      )}
    </div>
  );
}
