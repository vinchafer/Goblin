'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CancelDeletionInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [status, setStatus] = useState<'idle' | 'cancelling' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Kein Token im Link gefunden.');
      return;
    }
    setStatus('cancelling');
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    fetch(`${apiBase}/api/account/cancel-deletion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.ok) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMsg(body.error ?? 'Unbekannter Fehler');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Netzwerk-Fehler');
      });
  }, [token]);

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
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        {status === 'cancelling' && (
          <p style={{ color: 'var(--meta)' }}>Löschung wird abgebrochen…</p>
        )}
        {status === 'success' && (
          <>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 32,
                margin: '0 0 16px',
                color: 'var(--brand-green)',
              }}
            >
              Löschung abgebrochen
            </h1>
            <p style={{ marginBottom: 24, color: 'var(--text)' }}>
              Dein Konto ist wieder aktiv. Du kannst dich jetzt einloggen.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{
                padding: '12px 24px',
                background: 'var(--brand-green)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Zum Login
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 32,
                margin: '0 0 16px',
                color: 'var(--rust)',
              }}
            >
              Fehler
            </h1>
            <p style={{ color: 'var(--text)' }}>{errorMsg}</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function CancelDeletionPage() {
  return (
    <Suspense fallback={null}>
      <CancelDeletionInner />
    </Suspense>
  );
}
