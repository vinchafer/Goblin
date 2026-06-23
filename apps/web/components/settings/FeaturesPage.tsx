'use client';

import { useState, useEffect } from 'react';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { useLang, t } from '@/lib/use-lang';

// Honesty sprint: the former "Vorschläge" toggles (Websuche, Erinnerung,
// Spracheingabe) wrote `goblin-feature-*` keys that NOTHING read — the features
// don't exist yet, so the toggles did nothing. Removed. What remains is the one
// control that is genuinely wired: haptic feedback, persisted under the canonical
// `goblin-haptic` key the app actually reads (RecentChatRow + SettingsRoot).
const HAPTIC_KEY = 'goblin-haptic';

export function FeaturesPage() {
  const lang = useLang();
  const [haptic, setHaptic] = useState(true);

  useEffect(() => {
    setHaptic(localStorage.getItem(HAPTIC_KEY) !== 'false');
  }, []);

  const change = (v: boolean) => {
    setHaptic(v);
    localStorage.setItem(HAPTIC_KEY, String(v));
  };

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label={t(lang, 'App', 'App')}>
        <SettingsCard>
          <SettingsRow
            label={t(lang, 'Haptisches Feedback', 'Haptic feedback')}
            rightVariant="toggle"
            value={haptic}
            onChange={change}
            testId="toggle-haptic"
          />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
