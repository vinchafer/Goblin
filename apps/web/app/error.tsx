"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Lazy-import Sentry to avoid issues when DSN not set
    import('@sentry/nextjs').then(({ captureException }) => captureException(error)).catch(() => {});
  }, [error]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F4ED', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>🤕</div>
      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: '#2D4A2B', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 10 }}>
        Your goblin crashed.
      </h2>
      <p style={{ fontSize: 15, color: '#6B6B6B', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
        Something broke. We&apos;re on it.
      </p>
      {error.digest && (
        <p style={{ fontSize: 11, color: '#9C9589', marginBottom: 28, fontFamily: 'JetBrains Mono, monospace' }}>
          Error ID: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => reset()} style={{ background: '#2D4A2B', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Try again
        </button>
        <a href="/dashboard" style={{ background: 'transparent', color: '#6B6B6B', padding: '12px 24px', borderRadius: 10, fontSize: 14, textDecoration: 'none', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'DM Sans, sans-serif' }}>
          Back to workshop
        </a>
      </div>
    </div>
  );
}
