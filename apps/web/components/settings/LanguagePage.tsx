'use client';

import { useEffect, useState } from 'react';
import { SettingsCard } from '../ui/SettingsCard';

type Lang = 'DE' | 'EN';
const options: Lang[] = ['DE', 'EN'];

export function LanguagePage() {
  const [value, setValue] = useState<Lang>('DE');

  useEffect(() => {
    const stored = (localStorage.getItem('goblin-language') as Lang) ?? 'DE';
    setValue(stored);
  }, []);

  const pick = (v: Lang) => {
    setValue(v);
    localStorage.setItem('goblin-language', v);
  };

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsCard>
        {options.map((opt) => (
          <div
            key={opt}
            className="list-item"
            onClick={() => pick(opt)}
            data-testid={`lang-${opt}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 20px',
              minHeight: 56,
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, fontSize: 17, color: 'var(--text)' }}>{opt === 'DE' ? 'Deutsch' : 'English'}</span>
            {value === opt && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ))}
      </SettingsCard>
      <p style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 12, padding: '0 4px' }}>
        Vollständige Übersetzung in 9E.
      </p>
    </div>
  );
}
