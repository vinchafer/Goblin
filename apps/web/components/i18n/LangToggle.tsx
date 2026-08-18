'use client';

/**
 * WAVE-KORREKTUR-1 · U2 — the DE · EN switcher (founder decision).
 *
 * The founder's report was not "a string is untranslated", it was "I cannot tell
 * why I am getting this language". So this control does two jobs, and both are
 * honest:
 *
 *   1. It REPORTS the language currently resolved for sign-in and the app —
 *      which is what made the mystery a mystery. A founder whose onboarding
 *      answer was German now sees DE marked while standing on the English
 *      landing, which is the whole explanation for the German /login.
 *   2. It SETS an explicit choice (lib/locale.ts precedence 1), which outranks
 *      the stored preference and the browser's own languages, everywhere, and
 *      applies immediately — every mounted surface re-renders, no reload.
 *
 * Deliberately quiet: two text buttons and a separator. No flag icons (a flag is
 * a country, not a language), no dropdown chrome, no label. Colour is inherited
 * via `currentColor`, so the same component sits correctly in the landing nav,
 * the landing footer and the auth pages without a per-surface variant.
 *
 * Styles live in app/globals.css (`.lang-toggle*`); placement — nav on desktop,
 * footer on mobile — lives in styles/landing.css. See the note there for why.
 *
 * ── U6: `landingHrefs` ──────────────────────────────────────────────────────
 * Job 1 above described the control as REPORTING a language it could not apply
 * to the page you were standing on, because the landing was English-only. Now
 * that /de exists, the landing passes `landingHrefs` and the control also
 * NAVIGATES: DE goes to /de, EN goes to /. It stays a real anchor rather than a
 * scripted button, so it is crawlable, middle-clickable and works before
 * hydration — and the active side is marked aria-current="page" (a link is not
 * a toggle, so aria-pressed would be wrong on it).
 *
 * Setting the stored choice still happens on click, exactly as before: the
 * founder built this control so that picking DE here explains the German
 * /login, and dropping that would undo the fix it was written for.
 *
 * WITHOUT the prop — every app surface — this component behaves byte for byte
 * as it did: buttons, aria-pressed, no navigation.
 */

import { Fragment, useEffect, useState } from 'react';
import { resolveLang, setLangChoice, subscribeLang, type Lang } from '@/lib/locale';
import { persistLangToAccount } from '@/lib/account-lang';
import { landingPath } from '@/components/landing/copy';

const OPTIONS: Lang[] = ['de', 'en'];

export function LangToggle({
  className = '',
  style,
  landingHrefs = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** Landing surfaces only: render real links to / and /de (see note above). */
  landingHrefs?: boolean;
}) {
  // SSR renders 'en' (the public surface default) and the client corrects on
  // mount — same one-frame contract as every other locale-aware surface here, so
  // there is no hydration mismatch.
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const read = () => setLang(resolveLang({ fallback: 'en' }));
    read();
    return subscribeLang(read);
  }, []);

  return (
    <div
      className={`lang-toggle ${className}`.trim()}
      style={style}
      role="group"
      data-testid="lang-toggle"
      data-lang={lang}
      // Named in both languages, because whoever needs this control is by
      // definition not sure which one they are reading.
      aria-label="Sprache · Language"
      title={lang === 'de' ? 'Sprache für Anmeldung und App' : 'Language for sign-in and the app'}
    >
      {OPTIONS.map((option, i) => {
        // FINAL-POLISH · U5: the choice must follow the user, not the browser.
        // Fire-and-forget — signed out (the landing switcher) it no-ops, and a
        // failed mirror never undoes the local choice that just applied.
        const choose = () => {
          setLangChoice(option);
          void persistLangToAccount(option);
        };
        return (
          <Fragment key={option}>
            {i > 0 && <span className="lang-toggle__sep" aria-hidden="true">·</span>}
            {landingHrefs ? (
              <a
                lang={option}
                href={landingPath(option)}
                className="lang-toggle__opt"
                data-testid={`lang-toggle-${option}`}
                aria-current={lang === option ? 'page' : undefined}
                onClick={choose}
              >
                {option.toUpperCase()}
              </a>
            ) : (
              <button
                type="button"
                lang={option}
                className="lang-toggle__opt"
                data-testid={`lang-toggle-${option}`}
                aria-pressed={lang === option}
                onClick={choose}
              >
                {option.toUpperCase()}
              </button>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
