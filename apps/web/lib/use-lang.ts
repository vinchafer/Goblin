'use client';

// Shared language hook for the dashboard/app (11A Phase B).
//
// Reuses the SAME source of truth as the onboarding i18n (Sprint 10.10):
// localStorage('goblin:preferred-lang'), set at the Step-0 language choice and
// mirrored to users.preferred_lang. This is the one mechanism — onboarding's
// useOnbLang and this useLang read the identical key, so a DE choice in
// onboarding makes the dashboard render DE too. No second i18n system.
//
// WAVE-KORREKTUR-1 · U2: the resolution itself moved to lib/locale.ts, which is
// now the single place the precedence is written down (explicit switcher choice
// > stored preference > browser detection > surface default). This hook is the
// APP-surface binding of that rule: its surface default is 'de', because by the
// time a user sees these screens they have answered onboarding Step 0. It also
// re-renders when the DE·EN switcher fires, so a language change applies without
// a reload.
//
// WAVE-KORREKTUR-1 · U3 (regression fix): this binding explicitly opts OUT of
// browser detection. The first cut let it detect, and a signed-in session with
// no stored `goblin:preferred-lang` on an en-US browser started rendering the
// app in English — "Models" where SettingsRoot.tsx:86 had always said "Modelle".
// 14 @auth E2E tests caught it on master, and any key-less live account would
// have had the same silent flip. The browser's locale is a guess for someone we
// have never met; it is not a reason to change an established account's UI.
// Detection stays where it belongs: the public/pre-auth binding.

import { useEffect, useState } from 'react';
import { resolveLang, subscribeLang, type Lang } from './locale';

export type { Lang };

/** Synchronous read (event handlers, non-React code). Surface default 'de'. */
export function readLang(): Lang {
  return resolveLang({ fallback: 'de', useDetection: false });
}

/**
 * Reactive language. SSR renders the `de` default (matches Step-0 default); the
 * client corrects on mount — at most a one-frame flip if EN was chosen, no
 * hydration mismatch.
 */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('de');
  useEffect(() => {
    const read = () => setLang(readLang());
    read();
    return subscribeLang(read);
  }, []);
  return lang;
}

/** Pick the value for the active language. */
export function t<T>(lang: Lang, de: T, en: T): T {
  return lang === 'en' ? en : de;
}
