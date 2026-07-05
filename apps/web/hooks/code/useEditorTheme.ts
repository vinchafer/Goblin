'use client';
import { useEffect, useState, useCallback } from 'react';

export type EditorTheme = 'light' | 'dark';

const KEY = 'goblin:editorTheme';

/**
 * The Code-Tab editor surface theme. MOBILE-1 (M6): `prefers-color-scheme` is the
 * respected DEFAULT — a fresh user with the OS in dark mode gets dark. A manual
 * toggle (moon/sun, or Settings → Erscheinung) is persisted and wins over the OS
 * preference from then on. Only when NO manual choice is stored does the OS
 * preference drive the surface, and it stays live (reacts to OS changes).
 */
function systemPref(): EditorTheme {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  } catch { return 'light'; }
}

export function useEditorTheme(): [EditorTheme, (t: EditorTheme) => void, () => void] {
  // SSR renders 'light' (the server can't read the OS); the client corrects on mount.
  const [theme, setThemeState] = useState<EditorTheme>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') { setThemeState(stored); return; }
    } catch { /* SSR / privacy mode */ }
    // No manual choice → follow the OS, and keep following it live.
    setThemeState(systemPref());
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => {
      // Re-check: a manual choice made meanwhile takes precedence.
      try { if (localStorage.getItem(KEY)) return; } catch { /* ignore */ }
      setThemeState(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
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
