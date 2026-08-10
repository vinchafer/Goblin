'use client';

/**
 * WAVE-ABOUT-MANIFESTO · U4 — /about, the reading half.
 *
 * The client boundary starts here rather than at page.tsx so the route can keep
 * exporting real `metadata` (a client component cannot). Everything client-side
 * on this page is the locale: `useAuthLang()` is the PUBLIC/pre-auth binding of
 * the one precedence in lib/locale.ts — the binding PR #68 established after
 * /about shipped bound to the APP hook and handed a clean English visitor a
 * German page.
 *
 * There is no prose in this file. Every user-facing string comes from
 * lib/copy/about.ts, which is the point: a string written here would be a string
 * the German pass can never reach.
 */

import Link from 'next/link';
import { ABOUT_COPY } from '@/lib/copy/about';
import { RichText } from '@/lib/copy/rich-text';
import HtmlLangSync from '@/components/i18n/HtmlLangSync';
import { useProseLang } from '@/lib/copy/prose-locale';

export function AboutProse() {
  // The public/pre-auth binding, pinned to English until real German prose
  // exists — founder decision, documented in lib/copy/prose-locale.ts. The same
  // value drives `<html lang>` below, so the document cannot announce a language
  // it is not written in.
  const lang = useProseLang();
  const c = ABOUT_COPY[lang];

  return (
    <article className="lp-prose">
      {/* `<html lang>` follows the language this surface actually RENDERS IN —
          the same value the copy is selected with, never a second source. The
          root layout hard-codes lang="en"; PR #68 flagged that, and the fix is
          per-surface (see components/i18n/HtmlLangSync.tsx) — not a second
          hardcoded value here. */}
      <HtmlLangSync lang={lang} />

      <div className="lp-prose-inner">
        <Link href="/" className="lp-prose-back">{c.back}</Link>

        <header className="lp-prose-head">
          <div className="eyebrow">
            <span className="tick" aria-hidden="true" />
            {c.eyebrow}
          </div>
          <h1 className="lp-prose-h1">{c.h1}</h1>
        </header>

        {c.intro.map((p, i) => (
          <p key={i}><RichText>{p}</RichText></p>
        ))}

        <section className="lp-prose-section">
          <h2 className="lp-prose-h2">{c.gapHead}</h2>
          {c.gap.map((p, i) => (
            <p key={i}><RichText>{p}</RichText></p>
          ))}
        </section>

        <section className="lp-prose-section">
          <h2 className="lp-prose-h2">{c.whatHead}</h2>
          {c.what.map((p, i) => (
            <p key={i}><RichText>{p}</RichText></p>
          ))}
          {/* The marked spot. It sits directly under "Not ours. Yours — and
              that's not a feature, it's the deal." because that sentence is the
              manifesto's argument in miniature. */}
          <Link href="/manifesto" className="lp-prose-link-out" data-testid="about-manifesto-link">
            {c.manifestoLink}
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="lp-prose-section">
          <h2 className="lp-prose-h2">{c.whoHead}</h2>
          {c.who.map((p, i) => (
            <p key={i}><RichText>{p}</RichText></p>
          ))}
        </section>
      </div>
    </article>
  );
}

export default AboutProse;
