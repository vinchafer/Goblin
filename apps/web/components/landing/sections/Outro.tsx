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
