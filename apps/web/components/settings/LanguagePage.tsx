'use client';

import { useEffect, useState } from 'react';
import { SettingsCard } from '../ui/SettingsCard';
import { readLang, type Lang } from '@/lib/use-lang';
import { setLangChoice } from '@/lib/locale';
import { persistLangToAccount } from '@/lib/account-lang';

// Honesty sprint (F1): the selector used to write `goblin-language`, a key NOTHING
// read — the app's language is driven by `goblin:preferred-lang` (useLang), set at
// onboarding Step-0 and mirrored to users.preferred_lang.
//
// FINAL-POLISH · U5: it wrote the PREFERENCE key (precedence 2). Once the DE·EN
// switcher existed, a prior press of that switcher wrote the CHOICE key (precedence 1)
// and silently outranked this screen — picking a language in Settings would appear to
// do nothing. Picking a language here is an explicit choice by any reading, so it now
// records one, and mirrors it to the account through the same helper the switcher uses.

export function LanguagePage() {
  const [value, setValue] = useState<Lang>('de');

  useEffect(() => { setValue(readLang()); }, []);

  const pick = async (v: Lang) => {
    if (v === value) return;
    setValue(v);
    // Precedence 1 — outranks any earlier switcher press and the stored preference.
    setLangChoice(v);
    // Precedence 2's durable form, so the choice follows the user to another device.
    await persistLangToAccount(v);
    // setLangChoice already notifies every mounted surface; the reload stays because a
    // few server-rendered strings are resolved at request time, not by the hook.
    window.location.reload();
  };

  const options: { id: Lang; label: string }[] = [
    { id: 'de', label: 'Deutsch' },
    { id: 'en', label: 'English' },
  ];

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsCard>
        {options.map((opt) => (
          <div
            key={opt.id}
            className="list-item"
            onClick={() => void pick(opt.id)}
            data-testid={`lang-${opt.id.toUpperCase()}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 20px',
              minHeight: 56,
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, fontSize: 17, color: 'var(--text)' }}>{opt.label}</span>
            {value === opt.id && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ))}
      </SettingsCard>
    </div>
  );
}
