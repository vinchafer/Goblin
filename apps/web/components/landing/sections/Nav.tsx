import { Lockup } from '@/components/landing/brand/Lockup';
import { Button } from '@/components/landing/ui/Button';
import { ThemeToggle } from '@/components/landing/ui/ThemeToggle';
import { LangToggle } from '@/components/i18n/LangToggle';

export function Nav() {
  return (
    <nav className="lp-nav">
      <div className="container">
        <Lockup href="/" ariaLabel="Goblin home" />
        <div className="nav-links">
          <a href="#why">Why Goblin</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
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
