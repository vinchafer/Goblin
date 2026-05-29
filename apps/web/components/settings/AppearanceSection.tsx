'use client';

import { useState, useEffect } from 'react';
import { AppearancePage } from './AppearancePage';

type Appearance = 'System' | 'Hell' | 'Dunkel';

// Self-contained theme-state wrapper so AppearancePage (a canonical section
// component) renders unchanged inside the desktop SettingsModal. Mirrors the
// theme state SettingsRoot manages inline on mobile. AppearancePage untouched.
export function AppearanceSection() {
  const [appearance, setAppearance] = useState<Appearance>('System');

  useEffect(() => {
    const stored = localStorage.getItem('goblin_theme');
    setAppearance(stored === 'light' ? 'Hell' : stored === 'dark' ? 'Dunkel' : 'System');
  }, []);

  const onChange = (v: Appearance) => {
    setAppearance(v);
    localStorage.setItem('goblin_theme', v === 'Hell' ? 'light' : v === 'Dunkel' ? 'dark' : 'system');
  };

  return <AppearancePage value={appearance} onChange={onChange} />;
}
