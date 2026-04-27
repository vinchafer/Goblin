'use client';
import type { CSSProperties, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'ochre' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--moss)', color: '#fff', border: 'none' },
  ghost:   { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' },
  ochre:   { background: 'var(--ochre)', color: 'var(--bark)', border: 'none', boxShadow: '0 2px 8px rgba(201,147,58,0.25)' },
  danger:  { background: 'var(--danger)', color: '#fff', border: 'none' },
};

const sizes: Record<ButtonSize, CSSProperties> = {
  sm: { height: 32, padding: '0 12px', fontSize: 12, borderRadius: 7 },
  md: { height: 40, padding: '0 16px', fontSize: 13, borderRadius: 8 },
  lg: { height: 52, padding: '0 24px', fontSize: 15, borderRadius: 10 },
};

export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, fullWidth, type = 'button', style }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        ...sizes[size],
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all 0.15s',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === 'primary') el.style.background = 'var(--moss2)';
        if (variant === 'ghost') el.style.background = 'rgba(0,0,0,0.04)';
        if (variant === 'ochre') el.style.background = 'var(--ochre2)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === 'primary') el.style.background = 'var(--moss)';
        if (variant === 'ghost') el.style.background = 'transparent';
        if (variant === 'ochre') el.style.background = 'var(--ochre)';
        el.style.transform = '';
      }}
    >
      {children}
    </button>
  );
}
