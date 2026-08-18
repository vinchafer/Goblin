"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveTheme, type Theme, type ResolvedTheme } from "./theme-resolve";

export type { Theme, ResolvedTheme };

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('goblin_theme') as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    const applyTheme = (t: Theme) => {
      const resolved = resolveTheme(t, window.matchMedia('(prefers-color-scheme: dark)').matches);
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // F-08: only `system` follows the OS live; an explicit choice ignores it.
      if (theme === 'system') {
        const resolved = resolveTheme('system', mq.matches);
        setResolvedTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem('goblin_theme', t);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * FOUNDER-WALK-7 · U8 (D-G) — the resolved theme, for components that must not
 * crash outside the provider.
 *
 * `useTheme` throws without a provider, which is right for a settings control and
 * wrong for a code block: a chat code block is rendered in several trees (dashboard,
 * standalone chat, and any future embed), and a missing provider must degrade to the
 * light rendering — the one every surface had until now — not take the message down.
 */
export function useResolvedTheme(): { resolvedTheme: ResolvedTheme } {
  const ctx = useContext(ThemeContext);
  return { resolvedTheme: ctx?.resolvedTheme ?? 'light' };
}
