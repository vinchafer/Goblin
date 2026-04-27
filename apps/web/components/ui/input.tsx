'use client';
import type { CSSProperties } from 'react';

interface InputProps {
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}

export function Input({ type = 'text', value, onChange, placeholder, required, disabled, style }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      style={{
        width: '100%',
        height: 48,
        padding: '0 16px',
        borderRadius: 10,
        border: '1.5px solid var(--border)',
        background: '#fff',
        color: 'var(--text)',
        fontSize: 16,
        fontFamily: 'DM Sans, sans-serif',
        outline: 'none',
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
    />
  );
}
