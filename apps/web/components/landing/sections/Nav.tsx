import { Lockup } from '@/components/landing/brand/Lockup';
import { Button } from '@/components/landing/ui/Button';
import { ThemeToggle } from '@/components/landing/ui/ThemeToggle';
import { LangToggle } from '@/components/i18n/LangToggle';

/**
 * `anchorBase` — WAVE-ABOUT-MANIFESTO · U3. The four section links are in-page
 * anchors that exist only on the landing document. On the landing itself the base
 * stays empty and nothing changes. The public prose pages (/about, /manifesto)
 * reuse this nav and pass "/", turning each link into a navigation home that
 * lands on the section — because a nav link that does nothing when clicked is a
 * phantom affordance, not a minor imperfection.
 */
export function Nav({ anchorBase = '' }: { anchorBase?: string } = {}) {
  return (
    <nav className="lp-nav">
      <div className="container">
        <Lockup href="/" ariaLabel="Goblin home" />
        <div className="nav-links">
          <a href={`${anchorBase}#why`}>Why Goblin</a>
          <a href={`${anchorBase}#how`}>How it works</a>
          <a href={`${anchorBase}#pricing`}>Pricing</a>
          <a href={`${anchorBase}#faq`}>FAQ</a>
        </div>
        <div className="nav-end">
          {/* WAVE-KORREKTUR-1 · U2: desktop placement. Hidden ≤860px, where the
              footer instance takes over — see styles/landing.css. */}
          <LangToggle className="lang-toggle--nav" />
          <ThemeToggle />
          <a href="/login" className="nav-signin">Sign in</a>
          <Button href="/register" variant="primary">
            Start building <span className="arrow" aria-hidden="true">→</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
