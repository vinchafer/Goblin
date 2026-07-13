'use client';

import { AppearancePage } from './AppearancePage';
import { useTheme, type Theme } from '@/lib/theme';

type Appearance = 'System' | 'Hell' | 'Dunkel';

const toAppearance = (t: Theme): Appearance => (t === 'light' ? 'Hell' : t === 'dark' ? 'Dunkel' : 'System');
const toTheme = (a: Appearance): Theme => (a === 'Hell' ? 'light' : a === 'Dunkel' ? 'dark' : 'system');

// F-07: drive the appearance toggle through the ONE ThemeProvider so a pick
// applies `data-theme` live (setTheme) and stays the single source of truth —
// instead of writing goblin_theme to localStorage and never applying it.
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return <AppearancePage value={toAppearance(theme)} onChange={(v) => setTheme(toTheme(v))} />;
}
