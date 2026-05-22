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
        <Button href="#" variant="primary" size="large">
          Start building free <span className="arrow" aria-hidden="true">→</span>
        </Button>
        <div className="outro-foot">Public launch · 29 May MMXXVI</div>
      </div>
    </section>
  );
}
