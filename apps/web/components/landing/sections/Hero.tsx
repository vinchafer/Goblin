import { Button } from '@/components/landing/ui/Button';

// LANDING-MESSAGING v2 · L-3 — "The AI is built in" was ambiguous: built in WHERE?
// Next to "Installing Goblin…" and "Build on any device" a technical reader parsed
// it as embedded IN THE DEVICE, and the sentence that resolves it came later (and
// in the serif-italic the page otherwise uses for ornament — L-1). The lead now
// states the execution model in plain set, before anything else can suggest
// otherwise: servers first, then the models, then the device.
//
// LANGUAGE NOTE: the marketing landing is a static English page (see app/page.tsx
// — no i18n mechanism on the landing). The founder-authored German is preserved
// here so it is ready the day the landing is localized; it does not render today:
//
//   "Die Cloud-Werkstatt für alle, die nicht auf einen Laptop warten. Alles läuft
//    auf unseren Servern; du arbeitest im Browser. Beschreib, was du willst — der
//    Agent baut, prüft und veröffentlicht es, du siehst jeden Schritt und
//    übernimmst jederzeit. Auch die Modelle laufen bei uns — keine Keys, kein
//    Setup, kein Token-Zähler. Bau von jedem Gerät, push zu GitHub, geh live auf
//    deinem eigenen Vercel-Account."

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
          The cloud workshop for builders who don&apos;t wait for a laptop. Everything runs on
          our servers; you work in a browser. Describe what you want and the agent builds,
          verifies, and ships it — you watch every step and{' '}
          <span className="serif-italic">take control whenever you like.</span> The models run
          on our side too — no keys, no setup, no token counter. Build from any device, push to
          GitHub, go live on your own Vercel account.
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
