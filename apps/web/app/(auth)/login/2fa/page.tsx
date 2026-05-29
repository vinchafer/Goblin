'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginTwoFAInner() {
  const params = useSearchParams();
  const router = useRouter();
  const userId = params.get('userId');
  const [code, setCode] = useState('');
  const [isRecoveryCode, setIsRecoveryCode] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const verify = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError('');

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/auth/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, isRecoveryCode }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? 'Verifizierung fehlgeschlagen');
        setSubmitting(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          void fetch(`${apiBase}/api/account/sessions/register`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => undefined);
        }
      } catch {
        /* non-fatal */
      }
      router.push('/dashboard');
    } catch {
      setError('Netzwerk-Fehler');
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--paper)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 400, width: '100%' }}>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 28,
            margin: '0 0 16px',
            textAlign: 'center',
            color: 'var(--text)',
          }}
        >
          {isRecoveryCode ? 'Recovery-Code' : 'Authenticator-Code'}
        </h1>

        <input
          type="text"
          inputMode={isRecoveryCode ? 'text' : 'numeric'}
          maxLength={isRecoveryCode ? 20 : 6}
          value={code}
          onChange={(e) =>
            setCode(
              isRecoveryCode
                ? e.target.value.toUpperCase()
                : e.target.value.replace(/\D/g, ''),
            )
          }
          placeholder={isRecoveryCode ? 'XXXX-XXXXX' : '123456'}
          autoFocus
          style={{
            width: '100%',
            padding: 14,
            fontSize: 22,
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            border: '1px solid var(--div)',
            borderRadius: 10,
            marginBottom: 12,
            background: 'var(--panel)',
            color: 'var(--text)',
            letterSpacing: isRecoveryCode ? 1 : 6,
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <p style={{ color: 'var(--rust)', marginBottom: 12, textAlign: 'center', fontSize: 14 }}>
            {error}
          </p>
        )}

        <button
          onClick={verify}
          disabled={submitting || !code}
          style={{
            width: '100%',
            padding: 14,
            background: code && !submitting ? 'var(--brand-green)' : 'rgba(0,0,0,0.10)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: code && !submitting ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 16,
            marginBottom: 10,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {submitting ? 'Verifiziere…' : 'Verifizieren'}
        </button>

        <button
          onClick={() => {
            setIsRecoveryCode(!isRecoveryCode);
            setCode('');
            setError('');
          }}
          style={{
            width: '100%',
            padding: 8,
            background: 'transparent',
            color: 'var(--meta)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {isRecoveryCode ? 'Authenticator-Code stattdessen' : 'Recovery-Code stattdessen'}
        </button>

        <button
          onClick={cancel}
          style={{
            width: '100%',
            padding: 8,
            background: 'transparent',
            color: 'var(--meta)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            marginTop: 8,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Abbrechen und ausloggen
        </button>
      </div>
    </main>
  );
}

export default function LoginTwoFAPage() {
  return (
    <Suspense fallback={null}>
      <LoginTwoFAInner />
    </Suspense>
  );
}
