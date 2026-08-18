import { Lockup } from '@/components/landing/brand/Lockup';
import { Button } from '@/components/landing/ui/Button';
import { ThemeToggle } from '@/components/landing/ui/ThemeToggle';
import { LangToggle } from '@/components/i18n/LangToggle';
import { copy, landingPath } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

/**
 * `anchorBase` — WAVE-ABOUT-MANIFESTO · U3. The four section links are in-page
 * anchors that exist only on the landing document. On the landing itself the base
 * stays empty and nothing changes. The public prose pages (/about, /manifesto)
 * reuse this nav and pass "/", turning each link into a navigation home that
 * lands on the section — because a nav link that does nothing when clicked is a
 * phantom affordance, not a minor imperfection.
 *
 * U6 — `lang` labels the nav and, more importantly, tells the DE·EN control that
 * it is standing on a landing surface: `landingHrefs` makes it NAVIGATE between
 * / and /de. Without that the control set a language the page under it could not
 * honour. Anchors stay relative to the current document, so #pricing on /de
 * scrolls to the German pricing section rather than bouncing to the English page.
 */
export function Nav({ anchorBase = '', lang }: { anchorBase?: string; lang: Lang }) {
  const c = copy(lang).nav;
  return (
    <nav className="lp-nav">
      <div className="container">
        <Lockup href={landingPath(lang)} ariaLabel={c.home} />
        <div className="nav-links">
          <a href={`${anchorBase}#why`}>{c.why}</a>
          <a href={`${anchorBase}#how`}>{c.how}</a>
          <a href={`${anchorBase}#pricing`}>{c.pricing}</a>
          <a href={`${anchorBase}#faq`}>{c.faq}</a>
        </div>
        <div className="nav-end">
          {/* WAVE-KORREKTUR-1 · U2: desktop placement. Hidden ≤860px, where the
              footer instance takes over — see styles/landing.css. */}
          <LangToggle className="lang-toggle--nav" landingHrefs />
          <ThemeToggle />
          <a href="/login" className="nav-signin">{c.signIn}</a>
          <Button href="/register" variant="primary">
            {c.start} <span className="arrow" aria-hidden="true">→</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
