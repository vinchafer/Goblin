import type { CSSProperties, ReactNode } from 'react';

export function Card({ children, style, featured }: { children: ReactNode; style?: CSSProperties; featured?: boolean }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      border: featured ? '2px solid var(--brand-green)' : '1px solid var(--div)',
      padding: '20px',
      boxShadow: featured ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  );
}
