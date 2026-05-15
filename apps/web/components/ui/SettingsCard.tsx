import React from 'react';

export function SettingsCard({ children }: { children: React.ReactNode }) {
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
                marginLeft: 52,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
