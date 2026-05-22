'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem('goblin-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'light';
}

function findLandingRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.landing-root');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    setMounted(true);
    // sync .landing-root attribute on hydration so post-hydration toggles work
    const root = findLandingRoot();
    if (root) root.setAttribute('data-theme', initial);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem('goblin-theme', next);
    } catch {}
    const root = findLandingRoot();
    if (root) root.setAttribute('data-theme', next);
    const html = document.documentElement;
    html.classList.remove('lp2-dark', 'lp2-light');
    html.classList.add(next === 'dark' ? 'lp2-dark' : 'lp2-light');
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={mounted ? theme === 'dark' : undefined}
    >
      <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}
