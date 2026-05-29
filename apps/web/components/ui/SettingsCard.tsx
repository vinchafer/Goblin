import React from 'react';

/**
 * SettingsCard — grouped list card with hairline dividers between rows.
 *
 * `flushDivider` makes the divider span the full width (left edge 0) instead
 * of the default 52px inset. Use it for icon-less row groups (e.g. the account
 * menu, TASK 1) where an inset divider would float past nothing and read as a
 * broken indent. Default keeps the iOS-style inset that aligns under a leading
 * icon on the standard settings pages.
 */
export function SettingsCard({ children, flushDivider = false }: { children: React.ReactNode; flushDivider?: boolean }) {
  const items = React.Children.toArray(children);

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {items.map((child, i) => (
        <div key={i}>
          {child}
          {i < items.length - 1 && (
            <div
              style={{
                height: 1,
                background: 'var(--border-hairline)',
                marginLeft: flushDivider ? 0 : 52,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
