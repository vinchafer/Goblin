'use client';

import { IOSToggle } from './IOSToggle';

type RightVariant = 'chevron' | 'toggle' | 'dropdown' | 'text' | 'none';

interface SettingsRowProps {
  icon?: React.ReactNode;
  label: string;
  labelColor?: string;
  right?: React.ReactNode;
  rightVariant?: RightVariant;
  value?: boolean;
  onChange?: (v: boolean) => void;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}

const Chevron16 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronUpDown16 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 15 12 20 17 15" />
    <polyline points="7 9 12 4 17 9" />
  </svg>
);

export function SettingsRow({
  icon,
  label,
  labelColor,
  right,
  rightVariant = 'chevron',
  value,
  onChange,
  onClick,
  disabled,
  testId,
}: SettingsRowProps) {
  const handleClick = () => {
    if (disabled) return;
    if (rightVariant === 'toggle' && onChange) onChange(!value);
    else if (onClick) onClick();
  };

  return (
    <div
      data-testid={testId}
      onClick={handleClick}
      role={onClick || rightVariant === 'toggle' ? 'button' : undefined}
      tabIndex={onClick || rightVariant === 'toggle' ? 0 : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px 14px 20px',
        minHeight: 56,
        cursor: disabled ? 'not-allowed' : onClick || rightVariant === 'toggle' ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      {icon && (
        <span style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          flexShrink: 0,
        }}>
          {icon}
        </span>
      )}
      <span style={{
        flex: 1,
        minWidth: 0,
        fontSize: 17,
        fontFamily: 'var(--font-ui)',
        color: labelColor || 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>

      {(rightVariant === 'text' || rightVariant === 'chevron' || rightVariant === 'dropdown') && right && (
        <span style={{ fontSize: 15, color: 'var(--text-meta)', flexShrink: 0 }}>{right}</span>
      )}
      {rightVariant === 'chevron' && <span style={{ color: 'var(--text-meta)', flexShrink: 0, display: 'flex' }}><Chevron16 /></span>}
      {rightVariant === 'dropdown' && <span style={{ color: 'var(--text-meta)', flexShrink: 0, display: 'flex' }}><ChevronUpDown16 /></span>}
      {rightVariant === 'toggle' && (
        <IOSToggle value={!!value} onChange={onChange ?? (() => {})} disabled={disabled} ariaLabel={label} />
      )}
    </div>
  );
}
