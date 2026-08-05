'use client';

/**
 * FINAL-POLISH · U7.2 — make `<html lang>` tell the truth.
 *
 * `app/layout.tsx` hard-codes `lang="en"` on the root element for every route. On the
 * marketing landing that is correct — it is an English document whose long-form copy
 * exists in English only. Everywhere else it is simply wrong: the whole signed-in app
 * renders German by default while the document claims English.
 *
 * That is not cosmetic. `<html lang>` is what a screen reader picks a voice and
 * pronunciation rules from, what browsers offer "translate this page" against, and what
 * hyphenation and `:lang()` styling key off. A German page announced as English gets read
 * aloud in an English voice.
 *
 * `lib/locale.ts` deliberately does NOT set this inside `setLangChoice()`, and says why:
 * the root attribute belongs to the SURFACE, not to the setter, because the landing stays
 * English whatever the switcher says. So this is mounted per surface, takes the language
 * that surface actually resolved, and keeps the attribute in step — including when the
 * switcher fires, because the value comes from a live hook.
 *
 * Renders nothing.
 */

import { useEffect } from 'react';
import type { Lang } from '@/lib/locale';
import { useLang } from '@/lib/use-lang';

/** Sync the root attribute to an explicitly supplied language. */
export function HtmlLangSync({ lang }: { lang: Lang }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

/** The signed-in app surface: follows `useLang()` (the app binding). */
export function AppHtmlLangSync() {
  return <HtmlLangSync lang={useLang()} />;
}

export default HtmlLangSync;
