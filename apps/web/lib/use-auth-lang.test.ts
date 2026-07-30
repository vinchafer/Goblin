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

afterEach(() => { delete (globalThis as { window?: unknown }).window; });

describe('readAuthLang — pre-auth surfaces', () => {
  it('defaults to ENGLISH when nothing is stored (the clean visitor from the English landing)', () => {
    withLocalStorage(null);
    expect(readAuthLang()).toBe('en');
  });

  it('honours a stored German preference', () => {
    withLocalStorage('de');
    expect(readAuthLang()).toBe('de');
  });

  it('honours a stored English preference', () => {
    withLocalStorage('en');
    expect(readAuthLang()).toBe('en');
  });

  it('ignores a junk value rather than rendering an undefined locale', () => {
    withLocalStorage('fr');
    expect(readAuthLang()).toBe('en');
  });

  it('falls back to English when localStorage is unavailable (private mode, blocked storage)', () => {
    withLocalStorage('throws');
    expect(readAuthLang()).toBe('en');
  });
});

describe('the two sources differ exactly where it matters', () => {
  it('with no stored preference: app surfaces are German, pre-auth surfaces are English', () => {
    withLocalStorage(null);
    expect(readLang()).toBe('de');
    expect(readAuthLang()).toBe('en');
  });

  it('with a stored preference they agree — the split is only about the default', () => {
    withLocalStorage('de');
    expect(readLang()).toBe(readAuthLang());
    withLocalStorage('en');
    expect(readLang()).toBe(readAuthLang());
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
