import type { CSSProperties, ReactNode } from 'react';

export function Card({ children, style, featured }: { children: ReactNode; style?: CSSProperties; featured?: boolean }) {
  return (
    <div style={{
      background: 'var(--panel)',
      borderRadius: 14,
      border: featured ? '2px solid var(--moss)' : '1px solid var(--border)',
      padding: '24px',
      boxShadow: featured ? '0 8px 32px rgba(30,58,28,0.12)' : 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}
