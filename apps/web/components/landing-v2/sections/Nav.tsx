import { Lockup } from '@/components/landing-v2/brand/Lockup';
import { Button } from '@/components/landing-v2/ui/Button';
import { ThemeToggle } from '@/components/landing-v2/ui/ThemeToggle';

export function Nav() {
  return (
    <nav className="lp-nav">
      <div className="container">
        <Lockup href="#" ariaLabel="Goblin home" />
        <div className="nav-links">
          <a href="#why">Why Goblin</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-end">
          <ThemeToggle />
          <a href="#" className="nav-signin">Sign in</a>
          <Button href="#" variant="primary">
            Start building <span className="arrow" aria-hidden="true">→</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
