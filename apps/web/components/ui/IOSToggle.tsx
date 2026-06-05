'use client';

interface IOSToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}

export function IOSToggle({ value, onChange, disabled = false, ariaLabel, testId }: IOSToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      disabled={disabled}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!value);
      }}
      style={{
        // 10.11-C.3 — lock the flat-pill geometry so NO parent (flex/grid at
        // narrow mobile widths) and NO mobile-Safari UA button styling can
        // collapse it toward a square. width:height = 51:31 ≈ 1.65×; min/max
        // pin the width against flex squish, aspectRatio + box-sizing pin the
        // shape, appearance:none kills native control sizing on iOS.
        position: 'relative',
        appearance: 'none',
        WebkitAppearance: 'none',
        boxSizing: 'border-box',
        width: 51,
        minWidth: 51,
        maxWidth: 51,
        height: 31,
        minHeight: 31,
        aspectRatio: '51 / 31',
        borderRadius: 999,
        background: value ? 'var(--brand-green)' : 'var(--toggle-off)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 220ms ease',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          width: 27,
          height: 27,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16)',
          transition: 'left 220ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      />
    </button>
  );
}
