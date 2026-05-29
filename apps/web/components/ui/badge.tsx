import type { CSSProperties, ReactNode } from 'react';

type BadgeVariant = 'ochre' | 'moss' | 'success' | 'meta' | 'danger';

const styles: Record<BadgeVariant, CSSProperties> = {
  ochre:   { background: 'rgba(212,167,55,0.12)', color: 'var(--brand-gold)',   border: '1px solid rgba(212,167,55,0.3)' },
  moss:    { background: 'rgba(30,58,28,0.08)',   color: 'var(--brand-green)',    border: '1px solid rgba(30,58,28,0.15)' },
  success: { background: 'rgba(74,124,59,0.1)',   color: 'var(--success)', border: '1px solid rgba(74,124,59,0.25)' },
  meta:    { background: 'rgba(0,0,0,0.05)',      color: 'var(--meta)',    border: '1px solid var(--border)' },
  danger:  { background: 'rgba(184,92,60,0.1)',   color: 'var(--danger)',  border: '1px solid rgba(184,92,60,0.25)' },
};

export function Badge({ children, variant = 'meta' }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span style={{
      ...styles[variant],
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500,
      letterSpacing: '0.2px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}
