'use client';

import { SettingsCard } from '../ui/SettingsCard';

type Appearance = 'System' | 'Hell' | 'Dunkel';

const options: Appearance[] = ['System', 'Hell', 'Dunkel'];

export function AppearancePage({ value, onChange }: { value: Appearance; onChange: (v: Appearance) => void }) {
  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-ui)' }}>
      <SettingsCard>
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => onChange(opt)}
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ))}
      </SettingsCard>
      <p style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 12, padding: '0 4px' }}>
        Dunkler Modus aktiviert die dunklen Tokens. Wechsel ist in 9E vollständig getestet.
      </p>
    </div>
  );
}
