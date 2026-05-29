'use client';
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console (Sentry would pick this up via its integration)
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px', textAlign: 'center', height: '100%', minHeight: 200,
          fontFamily: 'var(--font-sans)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💀</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Goblin hiccupped.
          </div>
          <div style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20, lineHeight: 1.5 }}>
            Your work is safe. This tab crashed but other tabs should still work.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 18px', background: 'var(--brand-green)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Reload tab
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: 16, maxWidth: 400, textAlign: 'left' }}>
              <summary style={{ fontSize: 11, color: 'var(--disabled)', cursor: 'pointer' }}>Error details</summary>
              <pre style={{ fontSize: 10, color: 'var(--danger)', marginTop: 8, overflow: 'auto' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
