import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--brand-green)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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

      {/* Footer */}
      <footer style={{ background: 'var(--brand-green)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--t-caption-fs)', color: 'rgba(255,255,255,0.72)', fontFamily: 'var(--font-sans)' }}>
          © 2026 Goblin
        </span>
        <nav style={{ display: 'flex', gap: 16 }}>
          {[['Terms', '/terms'], ['Privacy', '/privacy'], ['Imprint', '/imprint']].map(([label, href]) => (
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
