import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      {/* Header — FOUNDER-WALK-3 U2: the legal pages (terms/privacy/imprint/
          acceptable-use) are full-screen and reachable from onboarding + the app,
          but were never safe-area-treated, so the green bar sat under the iOS
          clock on a standalone PWA. Reserve the top inset + landscape L/R insets
          with the shipped env() idiom (height grows by the inset so the wordmark
          clears the status bar). */}
      <header style={{ background: 'var(--brand-green)', padding: '0 24px', paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'max(24px, env(safe-area-inset-left))', paddingRight: 'max(24px, env(safe-area-inset-right))', height: 'calc(52px + env(safe-area-inset-top, 0px))', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>👺</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, color: 'var(--brand-gold)', letterSpacing: '-0.4px' }}>
            Goblin
          </span>
        </Link>
      </header>

      {/* Content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer — U2: bottom + landscape L/R insets so the © / links clear the
          home indicator and landscape notch on a standalone PWA. */}
      <footer style={{ background: 'var(--brand-green)', padding: '16px 24px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', paddingLeft: 'max(24px, env(safe-area-inset-left))', paddingRight: 'max(24px, env(safe-area-inset-right))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--t-caption-fs)', color: 'rgba(255,255,255,0.72)', fontFamily: 'var(--font-sans)' }}>
          © 2026 Goblin
        </span>
        <nav style={{ display: 'flex', gap: 16 }}>
          {[['Terms', '/terms'], ['Nutzung', '/acceptable-use'], ['Privacy', '/privacy'], ['Imprint', '/imprint']].map(([label, href]) => (
            <Link
              key={href}
              href={href!}
              style={{ fontSize: 'var(--t-caption-fs)', color: 'rgba(255,255,255,0.72)', textDecoration: 'none', fontFamily: 'var(--font-sans)', transition: 'color 0.15s' }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
