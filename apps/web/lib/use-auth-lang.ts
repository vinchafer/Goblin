'use client';

/**
 * PUBLIC / PRE-AUTH language (AKT1-STRANG-2 · U3, extended in WAVE-KORREKTUR-1 · U2).
 *
 * There are two locale bindings in Goblin and picking the wrong one is a visible
 * bug, so they are named rather than left implicit. Both are thin wrappers over
 * the ONE precedence in lib/locale.ts — they differ only in their surface
 * default, i.e. in the answer to "what if nothing is stored and the browser
 * tells us nothing":
 *
 *   lib/use-lang.ts      → useLang()     APP surfaces. Default 'de', because by
 *                                        the time a user sees them they have
 *                                        answered onboarding Step 0.
 *   lib/use-auth-lang.ts → useAuthLang() PUBLIC + PRE-AUTH surfaces. Default
 *                                        'en', because the visitor arrived from
 *                                        the English marketing landing.
 *
 * Why it moved out of the login page (U3): `/login` already defaulted to English,
 * but `/auth/confirm` and `/auth/reset-password` reached for `useLang()` and
 * therefore rendered GERMAN to a clean English visitor. Two hooks, same storage
 * key, opposite defaults.
 *
 * What U2 added: `/about`, `/help` and `/help/[slug]` are PUBLIC — one click from
 * the English landing footer — but were still bound to the app hook, so a clean
 * English visitor got a German page. They are bound here now. And an explicit
 * DE·EN choice (lib/locale.ts, precedence 1) overrides everything on both sides,
 * so the language a visitor is looking at carries across landing → auth → back.
 */

import { useEffect, useState } from 'react';
import { resolveLang, subscribeLang, type Lang } from './locale';

/** Synchronous read for event handlers and non-React code. Surface default 'en'. */
export function readAuthLang(): Lang {
  return resolveLang({ fallback: 'en' });
}

/**
 * Reactive public/pre-auth language. SSR renders 'en'; the client corrects on
 * mount — at most a one-frame flip for a visitor whose resolved language is
 * German. Re-renders when the DE·EN switcher fires, so a switch applies without
 * a reload.
 */
export function useAuthLang(): Lang {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const read = () => setLang(readAuthLang());
    read();
    return subscribeLang(read);
  }, []);
  return lang;
}
