// F-07/F-08 (FIX-WAVE 3) — the single theme-resolution rule.
//
// Two independent theme systems had drifted: the ThemeProvider context and the
// settings AppearancePage each resolved and applied `data-theme` on their own,
// and the settings sections persisted `goblin_theme` to localStorage WITHOUT
// updating the provider — so the app's resolved theme and the toggle could
// disagree (a system-dark user picking "Light" left surfaces stuck dark: the
// "settings sheet renders black" report). This is the one rule both now share.
//
// F-08 contract: `system` follows the OS live (systemPrefersDark decides), an
// explicit `light`/`dark` choice does NOT — it wins regardless of the OS.

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Resolve the concrete light/dark theme from the user's choice + the OS state. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light';
  return theme; // explicit choice is authoritative — never follows the OS
}
