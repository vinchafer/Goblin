'use client';

import { useEffect } from 'react';
import { SettingsCard } from '../ui/SettingsCard';

type Appearance = 'System' | 'Hell' | 'Dunkel';

const options: Appearance[] = ['System', 'Hell', 'Dunkel'];

function applyTheme(v: Appearance) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (v === 'System') {
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = prefers ? 'dark' : 'light';
  } else if (v === 'Hell') {
    root.dataset.theme = 'light';
  } else {
    root.dataset.theme = 'dark';
  }
}

export function AppearancePage({ value, onChange }: { value: Appearance; onChange: (v: Appearance) => void }) {
  useEffect(() => {
    applyTheme(value);
    if (value === 'System') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('System');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [value]);

  const pick = (v: Appearance) => {
    onChange(v);
    applyTheme(v);
  };

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsCard>
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => pick(opt)}
            data-testid={`appearance-${opt}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 20px',
              minHeight: 56,
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, fontSize: 17, color: 'var(--text)' }}>{opt}</span>
            {value === opt && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ))}
      </SettingsCard>
      <p style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 12, padding: '0 4px' }}>
        Hell / Dunkel überschreibt die Systemeinstellung. System folgt deinem Gerät.
      </p>
    </div>
  );
}
