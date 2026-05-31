"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Lazy-import Sentry to avoid issues when DSN not set
    import('@sentry/nextjs').then(({ captureException }) => captureException(error)).catch(() => {});
  }, [error]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>🤕</div>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 28, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 10 }}>
        Your goblin crashed.
      </h2>
      <p style={{ fontSize: 15, color: 'var(--meta)', marginBottom: 6, fontFamily: 'var(--font-sans)' }}>
        Something broke. We&apos;re on it.
      </p>
      {error.digest && (
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 28, fontFamily: 'JetBrains Mono, monospace' }}>
          Error ID: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => reset()} style={{ background: 'var(--brand-green)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 10, fontSize: 'var(--t-small-fs)', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Try again
        </button>
        <a href="/dashboard" style={{ background: 'transparent', color: 'var(--meta)', padding: '12px 24px', borderRadius: 10, fontSize: 'var(--t-small-fs)', textDecoration: 'none', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'var(--font-sans)' }}>
          Back to workshop
        </a>
      </div>
    </div>
  );
}
