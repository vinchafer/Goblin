import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAuthLang } from './use-auth-lang';
import { readLang } from './use-lang';

/**
 * U3 regression suite — the locale source of the pre-auth surfaces.
 *
 * The bug this guards against is not a missing translation: every string on
 * these pages has always existed in both languages. It is picking the wrong
 * *source* for "which language, when nothing is stored yet" — the same defect
 * the landing's InstallAppBlock carried, which reappeared on /auth/confirm and
 * /auth/reset-password.
 */

function withLocalStorage(value: string | null | 'throws') {
  const store = new Map<string, string>();
  if (value !== null && value !== 'throws') store.set('goblin:preferred-lang', value);
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => {
        if (value === 'throws') throw new Error('localStorage disabled');
        return store.get(k) ?? null;
      },
    },
  };
}

/**
 * WAVE-KORREKTUR-1 · U2: the precedence now has a DETECTION step between the
 * stored preference and the surface default, so a test about the *default* has
 * to silence detection or it is really testing the runner's own locale (Node 22
 * reports navigator.language === 'en-US'). `withBrowserLanguages(null)` removes
 * navigator entirely, which is the "browser tells us nothing" case.
 */
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
function withBrowserLanguages(langs: string[] | null) {
  if (langs === null) {
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
  } else {
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: langs, language: langs[0] },
      configurable: true,
    });
  }
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
});

describe('readAuthLang — public / pre-auth surfaces', () => {
  it('defaults to ENGLISH when nothing is stored and the browser says nothing', () => {
    withLocalStorage(null);
    withBrowserLanguages(null);
    expect(readAuthLang()).toBe('en');
  });

  it('honours a stored German preference', () => {
    withLocalStorage('de');
    withBrowserLanguages(['en-US']);
    expect(readAuthLang()).toBe('de');
  });

  it('honours a stored English preference', () => {
    withLocalStorage('en');
    expect(readAuthLang()).toBe('en');
  });

  it('ignores a junk value rather than rendering an undefined locale', () => {
    withLocalStorage('fr');
    withBrowserLanguages(null);
    expect(readAuthLang()).toBe('en');
  });

  it('falls back to English when localStorage is unavailable (private mode, blocked storage)', () => {
    withLocalStorage('throws');
    withBrowserLanguages(null);
    expect(readAuthLang()).toBe('en');
  });
});

describe('the two bindings differ exactly where it matters', () => {
  it('nothing stored AND no browser signal: app surfaces are German, public surfaces English', () => {
    withLocalStorage(null);
    withBrowserLanguages(null);
    expect(readLang()).toBe('de');
    expect(readAuthLang()).toBe('en');
  });

  it('with a stored preference they agree — the split is only about the default', () => {
    withBrowserLanguages(null);
    withLocalStorage('de');
    expect(readLang()).toBe(readAuthLang());
    withLocalStorage('en');
    expect(readLang()).toBe(readAuthLang());
  });

  // U2: detection sits between the preference and the default — but for the
  // PUBLIC binding only. It is what closed the "German browser, English login"
  // half of the founder's report.
  it('nothing stored, German browser: the public binding says German', () => {
    withLocalStorage(null);
    withBrowserLanguages(['de-CH', 'de']);
    expect(readAuthLang()).toBe('de');
  });

  it('nothing stored, English browser: the public binding says English', () => {
    withLocalStorage(null);
    withBrowserLanguages(['en-GB', 'en']);
    expect(readAuthLang()).toBe('en');
  });

  it('nothing stored, a language we do not ship: the surface default decides', () => {
    withLocalStorage(null);
    withBrowserLanguages(['fr-FR', 'fr']);
    expect(readLang()).toBe('de');
    expect(readAuthLang()).toBe('en');
  });

  /**
   * U3 REGRESSION GUARD — the exact failure that turned master red.
   *
   * The first cut of U2 let the APP binding detect too. CI's Playwright contexts
   * carry no stored preference and report en-US, so the signed-in app rendered
   * "Models" where SettingsRoot.tsx:86 had always rendered "Modelle" — 14 @auth
   * tests failed on master, and any key-less live account would have had the
   * same silent flip. The app's language is the account's answer, never the
   * browser's guess.
   */
  it('nothing stored, English browser: the APP binding stays GERMAN', () => {
    withLocalStorage(null);
    withBrowserLanguages(['en-US', 'en']);
    expect(readLang()).toBe('de');
  });

  it('an English browser cannot flip a German app account that never stored a key', () => {
    withLocalStorage(null);
    withBrowserLanguages(['en-US']);
    // What the signed-in settings surface actually renders.
    expect(readLang() === 'de' ? 'Modelle' : 'Models').toBe('Modelle');
  });

  it('…but an explicit switcher choice still reaches the app binding', () => {
    // The escape hatch stays open: a user who presses EN gets English everywhere.
    const store = new Map<string, string>([['goblin:lang-choice', 'en']]);
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null },
    };
    withBrowserLanguages(['de-DE']);
    expect(readLang()).toBe('en');
  });
});

/**
 * The static guard. The runtime tests above cannot catch the actual regression,
 * because the regression is a page importing the wrong hook. This can.
 */
describe('every pre-auth surface takes its locale from the pre-auth source', () => {
  const PRE_AUTH_PAGES = [
    'app/(auth)/login/page.tsx',
    'app/auth/confirm/page.tsx',
    'app/auth/reset-password/page.tsx',
  ];

  for (const rel of PRE_AUTH_PAGES) {
    it(`${rel} uses useAuthLang, never useLang`, () => {
      const src = readFileSync(join(__dirname, '..', rel), 'utf8');
      // It renders bilingual copy…
      expect(src).toMatch(/\bt\(lang,/);
      // …from the pre-auth source…
      expect(src).toMatch(/useAuthLang\(\)/);
      // …and never from the app-side one, whose default is German.
      expect(src).not.toMatch(/^\s*const lang = useLang\(\);/m);
      expect(src).not.toMatch(/import \{[^}]*\buseLang\b[^}]*\} from '@\/lib\/use-lang'/);
    });
  }
});
