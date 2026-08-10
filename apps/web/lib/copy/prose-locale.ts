'use client';

/**
 * WAVE-ABOUT-MANIFESTO · FOLLOW-UP — the prose pages are served in English to
 * everyone, on purpose, until real German prose exists.
 *
 * FOUNDER DECISION (2026-08-10). The first cut translated the page CHROME (the
 * back link, the eyebrow) while the long-form copy stayed English behind
 * `@needs-german`. On screen that read as half-finished rather than as an honest
 * gap: "Über uns" sitting on top of four English paragraphs looks like a broken
 * translation, not a pending one. Whole-page English reads as a deliberate
 * choice, which is what it is.
 *
 * WHY THIS IS A SWITCH AND NOT A DELETION OF THE i18n.
 * The key structure stays exactly as it was — both locales, every string in
 * lib/copy/{about,manifesto}.ts, nothing hardcoded in a component. Only the
 * SELECTION is pinned. So supplying the German is still a one-file edit per page
 * plus flipping the constant below, and no page has to be rewired.
 *
 * WHY `<html lang>` READS FROM HERE TOO — the part that matters.
 * These pages must declare the language they are actually rendering. If they
 * kept following the visitor's resolved locale, a German visitor would get an
 * English document announced as `lang="de"`: a screen reader would read English
 * prose with German pronunciation rules, and "translate this page" would offer
 * the wrong direction. That is the same class of defect PR #68 raised about the
 * root layout's hardcoded `lang="en"`, just pointing the other way.
 *
 * Content and `lang` therefore come from ONE value. They cannot drift apart,
 * and when the German lands both start following the visitor again in the same
 * commit.
 *
 * Nothing else on the site changes: /help, /login, the legal pages and the app
 * keep resolving normally through lib/locale.ts. The DE·EN switcher in the
 * footer still reports and sets the language of sign-in and the app — which is
 * its actual job (see components/i18n/LangToggle.tsx) — and pressing it here
 * still takes effect everywhere else.
 */

import type { Lang } from '@/lib/locale';
import { useAuthLang } from '@/lib/use-auth-lang';

/**
 * Flip to `true` in the same commit that replaces the `@needs-german` values in
 * lib/copy/about.ts and lib/copy/manifesto.ts with real German prose. Nothing
 * else needs to change. Typed `boolean` rather than left as the literal `false`
 * so both branches stay live code for the compiler.
 */
export const PROSE_GERMAN_READY: boolean = false;

/**
 * The language the prose pages RENDER IN — the resolved visitor locale once the
 * German exists, English until then. Also the value `<html lang>` is set from,
 * so the document never claims a language it is not written in.
 *
 * The hook is always called (never conditionally), so the rules of hooks hold
 * whichever side of the switch we are on.
 */
export function useProseLang(): Lang {
  const resolved = useAuthLang();
  return PROSE_GERMAN_READY ? resolved : 'en';
}
