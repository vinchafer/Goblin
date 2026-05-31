'use client';
import type { CSSProperties, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ochre' | 'ghost' | 'danger';
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
  loading?: boolean;
}

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { 
    background: 'var(--brand-green)', 
    color: '#fff', 
    border: 'none',
  },
  secondary: {
    background: 'var(--panel)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  ochre: { 
    background: 'var(--brand-gold)', 
    color: 'var(--ink-2)', 
    border: 'none',
    boxShadow: 'var(--shadow-gold)',
  },
  ghost: { 
    background: 'transparent', 
    color: 'var(--meta)', 
    border: 'none',
  },
  danger: { 
    background: 'var(--error)', 
    color: '#fff', 
    border: 'none',
  },
};

const sizes: Record<ButtonSize, CSSProperties> = {
  sm: { height: 32, padding: '0 12px', fontSize: 13, borderRadius: 8 },
  md: { height: 36, padding: '0 16px', fontSize: 13, borderRadius: 8 },
  lg: { height: 40, padding: '0 20px', fontSize: 'var(--t-small-fs)', borderRadius: 8 },
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
        fontFamily: 'var(--font-sans)',
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
        if (variant === 'primary') el.style.background = 'var(--green-600)';
        if (variant === 'secondary') el.style.background = 'var(--subtle)';
        if (variant === 'ochre') el.style.background = 'var(--gold-300)';
        if (variant === 'ghost') el.style.background = 'var(--subtle)';
        if (variant === 'danger') el.style.background = '#a04c30';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === 'primary') el.style.background = 'var(--brand-green)';
        if (variant === 'secondary') el.style.background = 'var(--panel)';
        if (variant === 'ochre') el.style.background = 'var(--brand-gold)';
        if (variant === 'ghost') el.style.background = 'transparent';
        if (variant === 'danger') el.style.background = 'var(--error)';
        el.style.transform = '';
      }}
    >
      {children}
    </button>
  );
}
