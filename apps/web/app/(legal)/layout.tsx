import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      color: 'var(--text)',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {children}
    </div>
  );
}
