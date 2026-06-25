import { Button } from '@/components/landing/ui/Button';
import { Lockup } from '@/components/landing/brand/Lockup';

export function Outro() {
  return (
    <section className="outro">
      <div className="outro-inner">
        <Lockup size="lg" ariaLabel="Goblin" />
        <p className="outro-tagline">
          Build anywhere.
          <br />
          <span className="serif-italic">Code anything.</span>
        </p>
        <p className="outro-why">
          Built by one person in Switzerland, for everyone who hit the same walls:
          subscriptions priced for San Francisco, tools built for $3,000 laptops. Goblin is
          for the rest of the planet.{' '}
          <a href="/manifesto" className="outro-why-link">Read the manifesto</a>
        </p>
        <Button href="/register" variant="primary" size="large">
          Start building free <span className="arrow" aria-hidden="true">→</span>
        </Button>
        {/* BUG-22 (Walk-4): honest status — the app is in beta, not "publicly
            launched" on a fixed date. Matches the hero "NOW IN BETA" eyebrow. */}
        <div className="outro-foot">Now in beta · Made in Switzerland</div>
      </div>
    </section>
  );
}
