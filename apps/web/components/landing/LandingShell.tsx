import { Manrope, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { copy, landingPath } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

/**
 * U6 — the landing's document shell, shared by / and /de.
 *
 * Fonts, the pre-paint theme script and the scoped `.landing-root` wrapper used
 * to live in app/page.tsx. With a second route they have to live in one place:
 * next/font instances must be module-level constants, and two copies would mean
 * two font loaders emitting two sets of CSS variables for the same three faces.
 */

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--lp2-font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--lp2-font-mono',
  display: 'swap',
});
const serif = Instrument_Serif({
  subsets: ['latin'],
  style: ['italic', 'normal'],
  weight: '400',
  variable: '--lp2-font-serif',
  display: 'swap',
});

const PRE_PAINT_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('goblin-theme');
    if (t === 'dark') document.documentElement.classList.add('lp2-dark');
    else if (t === 'light') document.documentElement.classList.add('lp2-light');
  } catch(e) {}
})();`;

/**
 * Title and description per language, plus the hreflang pair. The DE·EN control
 * is a real link now, but a crawler should not have to find it: `alternates`
 * states outright that these are two language versions of one page, and which
 * one is canonical for each.
 */
export function landingMetadata(lang: Lang): Metadata {
  const c = copy(lang).meta;
  return {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: landingPath(lang),
      languages: { en: '/', de: '/de', 'x-default': '/' },
    },
  };
}

export function LandingShell({ lang, children }: { lang: Lang; children: ReactNode }) {
  const rootClassName = `landing-root ${manrope.variable} ${mono.variable} ${serif.variable}`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <div
        className={rootClassName}
        lang={lang}
        data-theme="light"
        data-accent="restrained"
        data-density="compact"
      >
        {children}
      </div>
    </>
  );
}
