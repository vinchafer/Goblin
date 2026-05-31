'use client';
import { useEffect, useState, useCallback } from 'react';

export type EditorTheme = 'light' | 'dark';

const KEY = 'goblin:editorTheme';

/**
 * Sprint 6: the Code-Tab editor surface theme. LIGHT is the new default — the
 * old hardcoded dark surface (#28251D / #08170F) was unusable for the founder.
 * Dark is an opt-in (Settings → Erscheinung → Editor). Persisted per browser.
 */
export function useEditorTheme(): [EditorTheme, (t: EditorTheme) => void, () => void] {
  const [theme, setThemeState] = useState<EditorTheme>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') setThemeState(stored);
    } catch { /* SSR / privacy mode */ }
  }, []);

  const setTheme = useCallback((t: EditorTheme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
    // Broadcast so a Code Tab open in another part of the tree stays in sync.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('goblin:editorThemeChange', { detail: t }));
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  // Stay in sync if changed elsewhere (e.g. Settings page).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'light' || detail === 'dark') setThemeState(detail);
    };
    window.addEventListener('goblin:editorThemeChange', handler);
    return () => window.removeEventListener('goblin:editorThemeChange', handler);
  }, []);

  return [theme, setTheme, toggle];
}
