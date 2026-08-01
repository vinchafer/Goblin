'use client';

/**
 * WAVE-KORREKTUR-1 · U2 — THE ONE PLACE THE LOCALE PRECEDENCE IS DEFINED.
 *
 * Before this file there were two locale hooks with opposite defaults and no
 * shared rule between them, so "which language am I getting?" had no single
 * answer you could point at. The precedence is now written down once, here, and
 * both hooks are thin wrappers over `resolveLang()`:
 *
 *   1. EXPLICIT CHOICE  — the visitor pressed DE or EN in the switcher.
 *                         Key: `goblin:lang-choice`. Wins on EVERY surface,
 *                         always, and is never written by anything else.
 *   2. STORED PREFERENCE— the onboarding Step-0 answer, mirrored to
 *                         users.preferred_lang. Key: `goblin:preferred-lang`.
 *                         Applies to app + pre-auth surfaces.
 *   3. DETECTION        — the browser's own languages (navigator.languages →
 *                         Accept-Language). de* → 'de', en* → 'en', else skip.
 *   4. SURFACE DEFAULT  — 'en' for public/pre-auth surfaces (the visitor came
 *                         from the English marketing landing), 'de' for
 *                         signed-in app surfaces (by then Step 0 is answered).
 *
 * WHY THE EXPLICIT CHOICE NEEDS ITS OWN KEY.
 * `goblin:preferred-lang` already carries a different meaning: "the answer this
 * account gave at onboarding". FOUNDER-WALK U4 deliberately made the marketing
 * landing IGNORE it — a visitor who never chose anything must not be handed
 * German inside an English page (tests/e2e/33-landing-i18n.spec.ts pins that).
 * If the switcher wrote to the same key, "I pressed DE just now" and "this
 * account answered DE months ago" would be indistinguishable and that rule
 * could not survive. Two keys, one precedence, no ambiguity.
 *
 * WHAT THE MARKETING LANDING DOES. It stays an English document: its long-form
 * copy exists in English only, so it declares `lang="en"` for its localisable
 * blocks rather than resolving. The switcher shown there reports and sets the
 * language of sign-in and the app — which is exactly the mystery the founder
 * hit (an English landing handing him a German /login) and what it now answers.
 */

export type Lang = 'en' | 'de';

/** Explicit switcher choice. Precedence 1 — wins everywhere. */
export const LANG_CHOICE_KEY = 'goblin:lang-choice';
/** Onboarding Step-0 / account preference. Precedence 2. */
export const LANG_PREF_KEY = 'goblin:preferred-lang';
/** Dispatched on the window when the choice changes, so every mounted surface
 *  re-renders without a reload. */
export const LANG_CHANGE_EVENT = 'goblin:lang-change';

function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'de';
}

/** Read one storage key. Returns null when absent, junk, or storage is blocked. */
export function readStoredLang(key: string): Lang | null {
  try {
    const v = window.localStorage.getItem(key);
    return isLang(v) ? v : null;
  } catch {
    return null; // private mode / blocked storage — fall through the precedence
  }
}

/**
 * Precedence 3. Reads the browser's own language list; the same signal the
 * server would get as `Accept-Language`. Returns null for anything that is
 * neither German nor English, so the surface default decides instead of a
 * language we do not ship.
 */
export function detectLang(): Lang | null {
  try {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (!nav) return null;
    const tags = nav.languages && nav.languages.length ? nav.languages : [nav.language];
    for (const tag of tags) {
      if (!tag) continue;
      const primary = tag.toLowerCase().split('-')[0];
      if (primary === 'de') return 'de';
      if (primary === 'en') return 'en';
    }
  } catch {
    /* ignore — fall through to the surface default */
  }
  return null;
}

/**
 * The precedence, applied. `fallback` is the surface default (step 4);
 * `usePreference: false` opts a surface out of step 2 — used by surfaces that
 * must not inherit an account-scoped answer the visitor never gave here.
 */
export function resolveLang({
  fallback,
  usePreference = true,
}: { fallback: Lang; usePreference?: boolean }): Lang {
  const choice = readStoredLang(LANG_CHOICE_KEY);
  if (choice) return choice;                                     // 1
  if (usePreference) {
    const pref = readStoredLang(LANG_PREF_KEY);
    if (pref) return pref;                                       // 2
  }
  return detectLang() ?? fallback;                               // 3 → 4
}

/**
 * Record an explicit choice and apply it to every mounted surface immediately.
 * Persistence follows the existing pattern (localStorage, same as the theme and
 * the onboarding preference) — no new storage mechanism, no cookie.
 */
export function setLangChoice(next: Lang): void {
  try {
    window.localStorage.setItem(LANG_CHOICE_KEY, next);
  } catch {
    /* blocked storage: the choice still applies for this page's lifetime */
  }
  // Deliberately NOT writing document.documentElement.lang here. The root layout
  // hard-codes <html lang="en"> (app/layout.tsx:105) and the marketing landing is
  // an English document whatever this choice is, so flipping the root attribute
  // would mislabel that page. Making <html lang> track the surface's real
  // language is a correct follow-up, but it belongs to the surface, not to this
  // setter — reported as a finding rather than half-done here.
  try {
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to language changes: the in-page event (instant, same tab) and the
 * `storage` event (another tab flipped it). Returns an unsubscribe function.
 */
export function subscribeLang(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LANG_CHOICE_KEY || e.key === LANG_PREF_KEY) onChange();
  };
  window.addEventListener(LANG_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LANG_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
