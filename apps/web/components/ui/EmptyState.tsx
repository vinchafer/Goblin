'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void };
  icon?: ReactNode;
}

export function EmptyState({ title, description, cta, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {icon && <div style={{ color: 'var(--meta)', opacity: 0.6 }}>{icon}</div>}
      <h3 style={{ margin: 0, fontFamily: 'var(--font-brand)', fontSize: 20 }}>{title}</h3>
      {description && (
        <p style={{ margin: 0, color: 'var(--meta)', fontSize: 14, maxWidth: 380 }}>{description}</p>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            marginTop: 6,
            padding: '10px 18px',
            background: 'var(--moss)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            fontSize: 14,
          }}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Daten konnten nicht geladen werden.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        padding: '32px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <p style={{ margin: 0, color: 'var(--rust)', fontSize: 14 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--div)',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
          }}
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
