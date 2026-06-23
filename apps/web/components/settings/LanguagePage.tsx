'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { readLang, type Lang } from '@/lib/use-lang';

// Honesty sprint (F1): the selector used to write `goblin-language`, a key NOTHING
// read — the app's language is driven by `goblin:preferred-lang` (useLang), set at
// onboarding Step-0 and mirrored to users.preferred_lang. We now write THAT
// canonical key (+ the same server mirror onboarding uses) and reload, so the
// choice actually switches the UI.
const LS_KEY = 'goblin:preferred-lang';

export function LanguagePage() {
  const [value, setValue] = useState<Lang>('de');

  useEffect(() => { setValue(readLang()); }, []);

  const pick = async (v: Lang) => {
    if (v === value) return;
    setValue(v);
    try { localStorage.setItem(LS_KEY, v); } catch { /* ignore */ }
    // Best-effort server mirror — same column (users.preferred_lang, mig 0059)
    // the onboarding language step writes. Non-blocking.
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        await fetch(`${apiBase}/api/users/me`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferred_lang: v }),
        });
      }
    } catch { /* ignore — local choice still applies */ }
    // useLang reads the key once on mount; reload so every surface picks it up.
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
