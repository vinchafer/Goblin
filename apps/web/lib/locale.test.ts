import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LANG_CHOICE_KEY,
  LANG_PREF_KEY,
  LANG_CHANGE_EVENT,
  detectLang,
  hydrateAccountLang,
  readStoredLang,
  resolveLang,
  setLangChoice,
  subscribeLang,
} from './locale';

/**
 * WAVE-KORREKTUR-1 · U2 — the locale precedence, pinned.
 *
 * The founder's report was "the EN landing hands me a German /login, and I
 * cannot tell why". The diagnosis was not a missing translation: it was that
 * there was no single, statable rule for which language wins. These tests are
 * that rule, executable:
 *
 *   explicit switcher choice > stored onboarding preference > browser detection
 *   > surface default
 *
 * Two storage keys, deliberately: `goblin:lang-choice` (this visitor pressed a
 * button just now) must be distinguishable from `goblin:preferred-lang` (this
 * account answered onboarding Step 0), or the marketing landing could not keep
 * ignoring the second while honouring the first.
 */

type FakeStore = Record<string, string>;

function withEnv({ store = {}, languages = null as string[] | null, throwOnRead = false } = {}) {
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => {
        if (throwOnRead) throw new Error('localStorage disabled');
        return (store as FakeStore)[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (throwOnRead) throw new Error('localStorage disabled');
        (store as FakeStore)[k] = v;
      },
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      (listeners[type] ||= []).push(fn);
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = (listeners[type] || []).filter(f => f !== fn);
    },
    dispatchEvent: (e: { type: string }) => {
      for (const fn of listeners[e.type] || []) fn(e);
      return true;
    },
    CustomEvent: class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
  };
  // `new CustomEvent(...)` in locale.ts resolves through the global, not window.
  (globalThis as { CustomEvent?: unknown }).CustomEvent =
    (globalThis as { window: { CustomEvent: unknown } }).window.CustomEvent;

  if (languages === null) {
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
  } else {
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages, language: languages[0] },
      configurable: true,
    });
  }
  return { store: store as FakeStore, listeners };
}

const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { CustomEvent?: unknown }).CustomEvent;
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
});

describe('precedence 1 — an explicit switcher choice beats everything', () => {
  it('beats a stored onboarding preference that says the opposite', () => {
    withEnv({ store: { [LANG_CHOICE_KEY]: 'en', [LANG_PREF_KEY]: 'de' }, languages: ['de-DE'] });
    expect(resolveLang({ fallback: 'de' })).toBe('en');
  });

  it('beats browser detection that says the opposite', () => {
    withEnv({ store: { [LANG_CHOICE_KEY]: 'de' }, languages: ['en-US'] });
    expect(resolveLang({ fallback: 'en' })).toBe('de');
  });

  it("beats the surface default on BOTH surface kinds — this is the founder's fix", () => {
    withEnv({ store: { [LANG_CHOICE_KEY]: 'en' }, languages: null });
    expect(resolveLang({ fallback: 'en' })).toBe('en'); // public
    expect(resolveLang({ fallback: 'de' })).toBe('en'); // app
  });
});

describe('precedence 2 — the stored onboarding preference', () => {
  it('wins over detection', () => {
    withEnv({ store: { [LANG_PREF_KEY]: 'de' }, languages: ['en-US'] });
    expect(resolveLang({ fallback: 'en' })).toBe('de');
  });

  it('is skipped by a surface that opts out (usePreference: false)', () => {
    withEnv({ store: { [LANG_PREF_KEY]: 'de' }, languages: ['en-US'] });
    expect(resolveLang({ fallback: 'en', usePreference: false })).toBe('en');
  });

  it('does NOT override an explicit choice even when opted out', () => {
    withEnv({ store: { [LANG_CHOICE_KEY]: 'de', [LANG_PREF_KEY]: 'en' }, languages: ['en-US'] });
    expect(resolveLang({ fallback: 'en', usePreference: false })).toBe('de');
  });
});

describe('precedence 3 — browser detection (PUBLIC / pre-auth surfaces only)', () => {
  it('reads the first shipped language out of navigator.languages', () => {
    withEnv({ languages: ['fr-FR', 'de-CH', 'en-US'] });
    expect(detectLang()).toBe('de');
  });

  it('matches on the primary subtag, not the exact tag', () => {
    withEnv({ languages: ['de-AT'] });
    expect(detectLang()).toBe('de');
    withEnv({ languages: ['en-AU'] });
    expect(detectLang()).toBe('en');
  });

  it('returns null for a language we do not ship, so the default decides', () => {
    withEnv({ languages: ['ja-JP', 'ko-KR'] });
    expect(detectLang()).toBeNull();
    expect(resolveLang({ fallback: 'de' })).toBe('de');
    expect(resolveLang({ fallback: 'en' })).toBe('en');
  });

  it('survives a browser with no navigator at all', () => {
    withEnv({ languages: null });
    expect(detectLang()).toBeNull();
  });

  /**
   * U3 REGRESSION GUARD — the defect that turned master red at `e8c82bc`.
   *
   * Detection applied to the signed-in app binding meant a session with no
   * stored preference on an en-US browser rendered the app in English. 14 @auth
   * E2E tests caught it; a key-less live account would have been flipped just as
   * silently. `useDetection: false` is the opt-out, and it must keep working.
   */
  it('useDetection: false skips step 3 entirely and lands on the surface default', () => {
    withEnv({ languages: ['en-US', 'en'] });
    expect(resolveLang({ fallback: 'de' })).toBe('en');                        // public
    expect(resolveLang({ fallback: 'de', useDetection: false })).toBe('de');   // app
  });

  it('the opt-out does NOT block an explicit choice or a stored preference', () => {
    withEnv({ store: { [LANG_CHOICE_KEY]: 'en' }, languages: ['de-DE'] });
    expect(resolveLang({ fallback: 'de', useDetection: false })).toBe('en');
    withEnv({ store: { [LANG_PREF_KEY]: 'en' }, languages: ['de-DE'] });
    expect(resolveLang({ fallback: 'de', useDetection: false })).toBe('en');
  });
});

describe('precedence 4 — the surface default', () => {
  it('public/pre-auth is English, app is German, when nothing else speaks', () => {
    withEnv({ languages: null });
    expect(resolveLang({ fallback: 'en' })).toBe('en');
    expect(resolveLang({ fallback: 'de' })).toBe('de');
  });
});

describe('storage is never allowed to break a render', () => {
  it('blocked localStorage falls through to detection', () => {
    withEnv({ throwOnRead: true, languages: ['de-DE'] });
    expect(readStoredLang(LANG_CHOICE_KEY)).toBeNull();
    expect(resolveLang({ fallback: 'en' })).toBe('de');
  });

  it('a junk stored value is ignored rather than rendered', () => {
    withEnv({ store: { [LANG_CHOICE_KEY]: 'klingon' }, languages: null });
    expect(resolveLang({ fallback: 'en' })).toBe('en');
  });
});

describe('setLangChoice — persistence and instant apply', () => {
  it('persists to goblin:lang-choice and NOT to the onboarding key', () => {
    const { store } = withEnv({ languages: null });
    setLangChoice('de');
    expect(store[LANG_CHOICE_KEY]).toBe('de');
    expect(store[LANG_PREF_KEY]).toBeUndefined();
  });

  it('the choice survives a re-read — the switcher is sticky, not per-page', () => {
    withEnv({ languages: ['en-US'] });
    setLangChoice('de');
    expect(resolveLang({ fallback: 'en' })).toBe('de');
    setLangChoice('en');
    expect(resolveLang({ fallback: 'de' })).toBe('en');
  });

  it('notifies subscribers so mounted surfaces re-render without a reload', () => {
    withEnv({ languages: null });
    const seen = vi.fn();
    const unsubscribe = subscribeLang(seen);
    setLangChoice('de');
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLangChoice('en');
    expect(seen).toHaveBeenCalledTimes(1); // unsubscribed — no leak
  });

  it('a storage event from another tab also notifies', () => {
    const { listeners } = withEnv({ languages: null });
    const seen = vi.fn();
    subscribeLang(seen);
    for (const fn of listeners.storage || []) fn({ key: LANG_CHOICE_KEY });
    expect(seen).toHaveBeenCalledTimes(1);
    for (const fn of listeners.storage || []) fn({ key: 'goblin-theme' });
    expect(seen).toHaveBeenCalledTimes(1); // an unrelated key must not churn
  });

  it('does not throw when storage is blocked (private mode)', () => {
    withEnv({ throwOnRead: true, languages: null });
    expect(() => setLangChoice('de')).not.toThrow();
  });

  it('names the event it dispatches', () => {
    expect(LANG_CHANGE_EVENT).toBe('goblin:lang-change');
  });
});

/**
 * The static guard. The runtime tests above cannot catch the actual regression
 * class, which is a PUBLIC page importing the APP binding (surface default 'de')
 * and therefore rendering German at a clean English visitor. This can — it is
 * the same guard shape U3 added for the pre-auth pages, extended to the public
 * content pages that U2 found still on the wrong side.
 */
describe('every PUBLIC surface takes its locale from the public binding', () => {
  const PUBLIC_PAGES = [
    'app/about/page.tsx',
    'app/help/page.tsx',
    'components/help/HelpArticleBody.tsx',
    'app/(auth)/login/page.tsx',
    'app/auth/confirm/page.tsx',
    'app/auth/reset-password/page.tsx',
  ];

  for (const rel of PUBLIC_PAGES) {
    it(`${rel} uses useAuthLang, never useLang`, () => {
      const src = readFileSync(join(__dirname, '..', rel), 'utf8');
      expect(src).toMatch(/\bt\(lang,/);
      expect(src).toMatch(/useAuthLang\(\)/);
      expect(src).not.toMatch(/^\s*const lang(: Lang)? = useLang\(\);/m);
    });
  }
});

/** The precedence must be written down in exactly one place, and that place is
 *  lib/locale.ts. If a second module starts resolving on its own, this fails. */
describe('one precedence, one place', () => {
  // U3: the app binding must stay opted out of detection. A future edit that
  // drops this flag reintroduces the exact regression that turned master red.
  it('the APP binding opts out of browser detection', () => {
    const src = readFileSync(join(__dirname, '..', 'lib/use-lang.ts'), 'utf8');
    expect(src).toMatch(/useDetection:\s*false/);
  });

  it('the PUBLIC binding does NOT opt out — detection is the point there', () => {
    const src = readFileSync(join(__dirname, '..', 'lib/use-auth-lang.ts'), 'utf8');
    expect(src).not.toMatch(/useDetection:\s*false/);
  });

  it('both hooks delegate to lib/locale.ts rather than re-deriving', () => {
    for (const rel of ['lib/use-lang.ts', 'lib/use-auth-lang.ts']) {
      const src = readFileSync(join(__dirname, '..', rel), 'utf8');
      expect(src).toMatch(/from '\.\/locale'/);
      expect(src).toMatch(/resolveLang\(/);
      // No hook may read a storage key directly any more.
      expect(src).not.toMatch(/localStorage\.getItem/);
    }
  });

  it('the switcher writes only through setLangChoice', () => {
    const src = readFileSync(join(__dirname, '..', 'components/i18n/LangToggle.tsx'), 'utf8');
    expect(src).toMatch(/setLangChoice\(/);
    expect(src).not.toMatch(/localStorage\.setItem/);
  });
});


/**
 * FINAL-POLISH · U5 — the ACCOUNT's answer, finally read back.
 *
 * `users.preferred_lang` (migration 0059) was written at onboarding Step 0 and by the
 * settings picker, and then read by NOTHING. The preference lived in the localStorage of
 * the single browser that answered, so the same account on a second device fell straight
 * through to the surface default — an English user landing in a German app, because the
 * app binding defaults to 'de'.
 *
 * `hydrateAccountLang()` is that missing read. It writes the account value into the
 * SAME slot onboarding writes (precedence 2), so the account and the stored preference
 * are one level rather than two.
 */
describe('U5 — hydrating the account preference (cross-device)', () => {
  it('a second device with empty storage inherits the account language', () => {
    const { store } = withEnv({ store: {}, languages: ['de-DE'] });
    // Before: nothing stored, the app binding ignores detection → the 'de' default.
    expect(resolveLang({ fallback: 'de', useDetection: false })).toBe('de');

    hydrateAccountLang('en'); // the account answered English at onboarding

    expect(store[LANG_PREF_KEY]).toBe('en');
    expect(resolveLang({ fallback: 'de', useDetection: false })).toBe('en');
  });

  it('overwrites a DIFFERENT stored preference — the account is the answer', () => {
    // A shared browser can hold another account's leftover preference.
    const { store } = withEnv({ store: { [LANG_PREF_KEY]: 'de' } });
    expect(hydrateAccountLang('en')).toBe(true);
    expect(store[LANG_PREF_KEY]).toBe('en');
  });

  it('does nothing when the account already agrees (no needless event)', () => {
    const { listeners } = withEnv({ store: { [LANG_PREF_KEY]: 'en' } });
    let fired = 0;
    (listeners[LANG_CHANGE_EVENT] ||= []).push(() => { fired++; });
    expect(hydrateAccountLang('en')).toBe(false);
    expect(fired).toBe(0);
  });

  it('NEVER overrides an explicit switcher choice', () => {
    // The founder presses EN on this device; the account still says DE. Precedence 1
    // must win — a hydrate underneath must not flip the UI back.
    const { store } = withEnv({ store: { [LANG_CHOICE_KEY]: 'en' } });
    hydrateAccountLang('de');
    expect(store[LANG_PREF_KEY]).toBe('de');   // recorded at its own level…
    expect(resolveLang({ fallback: 'de' })).toBe('en'); // …but the choice still wins
  });

  it('does not re-render surfaces when an explicit choice is masking the account', () => {
    const { listeners } = withEnv({ store: { [LANG_CHOICE_KEY]: 'en' } });
    let fired = 0;
    (listeners[LANG_CHANGE_EVENT] ||= []).push(() => { fired++; });
    hydrateAccountLang('de');
    expect(fired).toBe(0); // nothing visible changed, so nothing should flip
  });

  it('ignores a null/absent/garbage account value rather than guessing', () => {
    const { store } = withEnv({ store: { [LANG_PREF_KEY]: 'de' } });
    for (const junk of [null, undefined, '', 'fr', 'EN', 42]) {
      expect(hydrateAccountLang(junk)).toBe(false);
    }
    expect(store[LANG_PREF_KEY]).toBe('de'); // untouched
  });

  it('blocked storage degrades quietly', () => {
    withEnv({ store: {}, throwOnRead: true });
    expect(() => hydrateAccountLang('en')).not.toThrow();
    expect(hydrateAccountLang('en')).toBe(false);
  });

  it('notifies mounted surfaces so the language applies without a reload', () => {
    const { listeners } = withEnv({ store: {} });
    let seen: unknown = null;
    (listeners[LANG_CHANGE_EVENT] ||= []).push((e) => { seen = (e as { detail: unknown }).detail; });
    hydrateAccountLang('en');
    expect(seen).toBe('en');
  });
});

describe('U5 — the account bridge stays out of the precedence', () => {
  const bridge = readFileSync(join(__dirname, '..', 'lib/account-lang.ts'), 'utf8');

  it('never touches a storage key directly — it goes through locale.ts', () => {
    // Calls only — the header comment explains the mechanism, and prose is not a write.
    expect(bridge).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
    expect(bridge).toMatch(/hydrateAccountLang\(/);
  });

  it('reads and writes users.preferred_lang, and nothing else', () => {
    expect(bridge).toMatch(/\/api\/users\/me/);
    expect(bridge).toMatch(/preferred_lang/);
  });

  it('is best-effort in both directions — a language preference never throws', () => {
    // Every network path is wrapped; a signed-out caller no-ops.
    expect(bridge).toMatch(/catch \{/);
    expect(bridge).toMatch(/if \(!headers\) return/);
  });
});

describe('U5 — every explicit picker persists to the account', () => {
  it('the DE·EN switcher mirrors the choice', () => {
    const src = readFileSync(join(__dirname, '..', 'components/i18n/LangToggle.tsx'), 'utf8');
    expect(src).toMatch(/setLangChoice\(option\)/);
    expect(src).toMatch(/persistLangToAccount\(option\)/);
  });

  it('the settings language picker records a CHOICE, not just a preference', () => {
    // It used to write only the preference key, which a previous switcher press
    // (precedence 1) silently outranked — picking a language did nothing.
    const src = readFileSync(join(__dirname, '..', 'components/settings/LanguagePage.tsx'), 'utf8');
    expect(src).toMatch(/setLangChoice\(v\)/);
    expect(src).toMatch(/persistLangToAccount\(v\)/);
    expect(src).not.toMatch(/localStorage\.setItem/);
  });

  it('the authenticated shell performs the read-back on mount', () => {
    const src = readFileSync(join(__dirname, '..', 'components/app-shell/dashboard-shell.tsx'), 'utf8');
    expect(src).toMatch(/hydrateLangFromAccount\(/);
  });
});
