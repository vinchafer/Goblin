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
        height: 36,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid var(--div)',
        background: '#fff',
        color: 'var(--text)',
        fontSize: 13,
        fontFamily: 'DM Sans, sans-serif',
        outline: 'none',
        transition: 'all 0.15s',
        ...style,
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--moss)';
        e.target.style.boxShadow = '0 0 0 3px rgba(45,74,43,0.1)';
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--div)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}
