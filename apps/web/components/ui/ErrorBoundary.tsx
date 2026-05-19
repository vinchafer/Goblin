'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize: 24,
              margin: '0 0 8px',
              color: 'var(--text)',
            }}
          >
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ margin: '0 0 16px', color: 'var(--meta)' }}>
            {this.state.error?.message ?? 'Unbekannter Fehler.'}
          </p>
          <button
            onClick={() => {
              this.reset();
              if (typeof window !== 'undefined') window.location.reload();
            }}
            style={{
              padding: '10px 16px',
              background: 'var(--moss)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
            }}
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }
}
