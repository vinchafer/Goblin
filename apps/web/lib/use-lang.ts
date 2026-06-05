'use client';

// Shared language hook for the dashboard/app (11A Phase B).
//
// Reuses the SAME source of truth as the onboarding i18n (Sprint 10.10):
// localStorage('goblin:preferred-lang'), set at the Step-0 language choice and
// mirrored to users.preferred_lang. This is the one mechanism — onboarding's
// useOnbLang and this useLang read the identical key, so a DE choice in
// onboarding makes the dashboard render DE too. No second i18n system.

import { useEffect, useState } from 'react';

export type Lang = 'en' | 'de';

const LS_KEY = 'goblin:preferred-lang';

/** Synchronous read (event handlers, non-React code). Defaults to 'de'. */
export function readLang(): Lang {
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === 'en' || v === 'de') return v;
  } catch {
    /* ignore */
  }
  return 'de';
}

/**
 * Reactive language. SSR renders the `de` default (matches Step-0 default); the
 * client corrects on mount — at most a one-frame flip if EN was chosen, no
 * hydration mismatch.
 */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('de');
  useEffect(() => { setLang(readLang()); }, []);
  return lang;
}

/** Pick the value for the active language. */
export function t<T>(lang: Lang, de: T, en: T): T {
  return lang === 'en' ? en : de;
}
