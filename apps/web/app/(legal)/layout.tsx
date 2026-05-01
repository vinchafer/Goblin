import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--moss)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>👺</span>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: 'var(--ochre)', letterSpacing: '-0.4px' }}>
            Goblin
          </span>
        </Link>
      </header>

      {/* Content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--moss)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans, sans-serif' }}>
          © 2026 Goblin
        </span>
        <nav style={{ display: 'flex', gap: 16 }}>
          {[['Terms', '/terms'], ['Privacy', '/privacy'], ['Imprint', '/imprint']].map(([label, href]) => (
            <Link
              key={href}
              href={href!}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'color 0.15s' }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
