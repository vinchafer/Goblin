'use client';

/**
 * Pre-auth language (AKT1-STRANG-2 · U3).
 *
 * There are two locale sources in Goblin and picking the wrong one is a visible
 * bug, so they are named rather than left implicit:
 *
 *   lib/use-lang.ts      → useLang()     APP surfaces. Defaults to 'de', because
 *                                        by the time a user sees them they have
 *                                        answered onboarding Step 0 and the
 *                                        preference really is stored.
 *   lib/use-auth-lang.ts → useAuthLang() PRE-AUTH surfaces. Defaults to 'en',
 *                                        because the visitor arrived from the
 *                                        English marketing landing and has no
 *                                        stored preference yet.
 *
 * Both read the SAME key (`goblin:preferred-lang`) — this is not a second i18n
 * system, only a different answer to "what if nothing is stored yet".
 *
 * Why it moved out of the login page: `/login` already defaulted to English, but
 * `/auth/confirm` and `/auth/reset-password` — the two surfaces added by the
 * reset-chain work — reached for `useLang()` and therefore rendered GERMAN to a
 * clean English visitor. Verified against this checkout, server-rendered first
 * paint (see _sprint/akt1-strang-2/auth-i18n-sweep.md). That is the same defect
 * the landing's InstallAppBlock carried, one file over, and it is fixed the same
 * way: the surface declares which locale source it belongs to.
 */

import { useEffect, useState } from 'react';
import type { Lang } from './use-lang';

const LS_KEY = 'goblin:preferred-lang';

/** Synchronous read for event handlers and non-React code. Defaults to 'en'. */
export function readAuthLang(): Lang {
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === 'en' || v === 'de') return v;
  } catch {
    /* ignore — keep the English default */
  }
  return 'en';
}

/**
 * Reactive pre-auth language. SSR renders 'en'; the client corrects on mount —
 * at most a one-frame flip for a returning user who chose German.
 */
export function useAuthLang(): Lang {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => { setLang(readAuthLang()); }, []);
  return lang;
}
