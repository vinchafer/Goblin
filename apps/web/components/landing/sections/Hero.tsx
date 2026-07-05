import { Button } from '@/components/landing/ui/Button';

export function Hero() {
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
          <span>v1.0 · Now in beta</span>
        </div>

        <h1 className="hero-h1">
          Tell it what you want.
          <br />
          <span className="serif-italic">It ships.</span>
        </h1>

        <p className="hero-lead">
          The cloud workshop for builders who don&apos;t wait for a laptop. The AI is built in —
          no keys, no setup, no token counter. Build on any device, push to GitHub, deploy in
          ~34 seconds. Want the frontier? <span className="serif-italic">Bring your own key.</span>
        </p>

        <div className="hero-cta">
          <Button href="/register" variant="primary" size="large">
            Start building free <span className="arrow" aria-hidden="true">→</span>
          </Button>
          <Button href="#how" variant="secondary" size="large">
            See how it works
          </Button>
        </div>

        <div className="hero-foot">
          <span className="dot" aria-hidden="true" />
          <span>7-day free trial</span>
          <span className="rule" aria-hidden="true" />
          <span>No credit card required</span>
        </div>
      </div>
    </section>
  );
}
