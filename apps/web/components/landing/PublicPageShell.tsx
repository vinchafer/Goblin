/**
 * WAVE-ABOUT-MANIFESTO · U3 — the landing's frame, reused by the public prose pages.
 *
 * /about and /manifesto used to be bare `max-w-2xl` columns on the app's global
 * surface: no nav, no footer, no theme toggle, no DE·EN switcher, a different
 * type scale and a different background from the page a visitor had just clicked
 * away from. They read as attachments to the product rather than pages of the
 * site. Wrapping them in the landing's own frame is what makes them the same
 * site — the same fixed nav, the same footer (which is where their own links
 * live), the same pre-paint theme switch, the same tokens.
 *
 * WHY THIS IS A COPY OF app/page.tsx's SHELL AND NOT AN EXTRACTION FROM IT.
 * The landing is the live front door and the first cohort is on the product as
 * of 2026-08-09. Refactoring `app/page.tsx` to consume this component would put
 * a rendering change on that page in a wave whose subject is two other routes —
 * the drive-by class the methodology's Law 1 exists to prevent. The landing is
 * therefore untouched. This shell is deliberately kept identical to it so the
 * landing can adopt it later as a pure, separately-verifiable no-op.
 *
 * The nav's section links are the one real difference and the reason `anchorBase`
 * exists — see the note on that prop.
 */

import { Manrope, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';
import { GoblinMarkSprite } from '@/components/landing/brand/GoblinMarkSprite';
import { Nav } from '@/components/landing/sections/Nav';
import { Footer } from '@/components/landing/sections/Footer';
import '@/styles/landing.css';

// Same three families, same variable names and weights as app/page.tsx — next/font
// self-hosts and dedupes by config, so this declares the same faces rather than
// adding a second set.
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

// Byte-identical to app/page.tsx's PRE_PAINT_SCRIPT. It must run before first
// paint, or a visitor with the dark theme stored sees a cream flash on every
// navigation into these pages.
const PRE_PAINT_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('goblin-theme');
    if (t === 'dark') document.documentElement.classList.add('lp2-dark');
    else if (t === 'light') document.documentElement.classList.add('lp2-light');
  } catch(e) {}
})();`;

export function PublicPageShell({ children }: { children: ReactNode }) {
  const rootClassName = `landing-root ${manrope.variable} ${mono.variable} ${serif.variable}`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <div
        className={rootClassName}
        data-theme="light"
        data-accent="restrained"
        data-density="compact"
      >
        <GoblinMarkSprite />
        <a href="#main" className="skip-link">Skip to content</a>
        {/* anchorBase="/" — the nav's links are in-page anchors (#pricing, #faq)
            that exist only on the landing. Left relative they would be dead
            clicks here, which is the phantom-affordance the anti-pattern catalog
            forbids; prefixed they navigate home and land on the section. */}
        <Nav anchorBase="/" />
        <main id="main">{children}</main>
        <Footer />
      </div>
    </>
  );
}

export default PublicPageShell;
