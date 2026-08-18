import { Button } from '@/components/landing/ui/Button';
import { Lockup } from '@/components/landing/brand/Lockup';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

export function Outro({ lang }: { lang: Lang }) {
  const c = copy(lang).outro;
  return (
    <section className="outro">
      <div className="outro-inner">
        <Lockup size="lg" ariaLabel="Goblin" />
        <p className="outro-tagline">
          {c.tagline.a}
          <br />
          <span className="serif-italic">{c.tagline.i}</span>
        </p>
        {/* LANDING-MESSAGING v2 · L-5 — "tools built for $3,000 laptops" restated
            the same false trail as the old "Hardware wall": it reads as a claim
            about inference hardware, when the wall it means is the set-up
            developer machine. Naming the real precondition also lets the closing
            line land the execution model one last time: Goblin assumes a browser. */}
        <p className="outro-why">
          {c.why}{' '}
          <a href="/manifesto" className="outro-why-link">{c.whyLink}</a>
        </p>
        <Button href="/register" variant="primary" size="large">
          {c.cta} <span className="arrow" aria-hidden="true">→</span>
        </Button>
        {/* BUG-22 (Walk-4): honest status — the app is in beta, not "publicly
            launched" on a fixed date. Matches the hero "NOW IN BETA" eyebrow. */}
        <div className="outro-foot">{c.foot}</div>
      </div>
    </section>
  );
}
