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
        {/* LANDING-MESSAGING v2 · L-5 — "tools built for $3,000 laptops" restated
            the same false trail as the old "Hardware wall": it reads as a claim
            about inference hardware, when the wall it means is the set-up
            developer machine. Naming the real precondition also lets the closing
            line land the execution model one last time: Goblin assumes a browser.

            LANGUAGE NOTE: static English landing. Founder-authored German, ready
            for localization: "Von einer Person in der Schweiz gebaut, für alle,
            die an dieselben Wände gelaufen sind: Abos mit San-Francisco-Preisen
            und Werkzeuge, die einen fertig eingerichteten Entwicklerrechner
            voraussetzen. Goblin setzt einen Browser voraus. Für den Rest des
            Planeten." */}
        <p className="outro-why">
          Built by one person in Switzerland, for everyone who hit the same walls:
          subscriptions priced for San Francisco, and tools that assume a set-up developer
          machine. Goblin assumes a browser. It is for the rest of the planet.{' '}
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
