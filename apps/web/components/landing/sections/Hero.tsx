import { Button } from '@/components/landing/ui/Button';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// LANDING-MESSAGING v2 · L-3 — "The AI is built in" was ambiguous: built in WHERE?
// Next to "Installing Goblin…" and "Build on any device" a technical reader parsed
// it as embedded IN THE DEVICE, and the sentence that resolves it came later (and
// in the serif-italic the page otherwise uses for ornament — L-1). The lead now
// states the execution model in plain set, before anything else can suggest
// otherwise: servers first, then the models, then the device.
//
// U6: copy moved to components/landing/copy.ts, which carries both languages.

export function Hero({ lang }: { lang: Lang }) {
  const c = copy(lang).hero;
  return (
    <section className="hero">
      <div className="hero-watermark" aria-hidden="true">
        <svg>
          <use href="#goblin-mark" />
        </svg>
      </div>
      <div className="hero-vignette" aria-hidden="true" />

      <div className="hero-inner">
        <div className="eyebrow">
          <span className="tick" aria-hidden="true" />
          <span className="num">GBLN</span>
          <span>·</span>
          <span>{c.status}</span>
        </div>

        <h1 className="hero-h1">
          {c.head.a}
          <br />
          <span className="serif-italic">{c.head.i}</span>
        </h1>

        <p className="hero-lead">
          {c.leadA} <span className="serif-italic">{c.leadI}</span> {c.leadB}
        </p>

        <div className="hero-cta">
          <Button href="/register" variant="primary" size="large">
            {c.ctaPrimary} <span className="arrow" aria-hidden="true">→</span>
          </Button>
          <Button href="#how" variant="secondary" size="large">
            {c.ctaSecondary}
          </Button>
        </div>

        <div className="hero-foot">
          <span className="dot" aria-hidden="true" />
          <span>{c.trial}</span>
          <span className="rule" aria-hidden="true" />
          <span>{c.noCard}</span>
        </div>
      </div>
    </section>
  );
}
