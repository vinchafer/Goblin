import { SectionHead } from '@/components/landing/ui/SectionHead';
import { buildsPerMonth } from '@/lib/plan-builds';
import { storageLabelCloud } from '@/lib/plan-storage';

const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

type Plan = {
  label: string;
  tagline: string;
  price: string;
  suffix: string;
  features: string[];
  recommended?: boolean;
};

const PLANS: Plan[] = [
  {
    label: 'Build',
    tagline: 'Start free, ship fast.',
    price: '$11',
    suffix: '/ month',
    features: [
      'Goblin Swift + Forge included — no key, no token counter',
      buildsPerMonth('build', 'en'),
      'Unlimited projects',
      'Bring your own keys too — every major provider, $0 Goblin margin',
      storageLabelCloud('build', 'en'),
      'GitHub push integration',
      'Build from any device',
    ],
  },
  {
    label: 'Pro',
    tagline: 'For shipping serious projects.',
    price: '$19',
    suffix: '/ month',
    recommended: true,
    features: [
      'Goblin Swift + Forge included — no key, no token counter',
      buildsPerMonth('pro', 'en'),
      'Unlimited projects',
      'Bring your own keys too — every major provider, $0 Goblin margin',
      storageLabelCloud('pro', 'en'),
      'GitHub push integration',
      'Build from any device',
    ],
  },
  {
    label: 'Power',
    tagline: 'For builders who never stop.',
    price: '$39',
    suffix: '/ month',
    features: [
      'Goblin Swift + Forge included — no key, no token counter',
      buildsPerMonth('power', 'en'),
      'Unlimited projects',
      'Bring your own keys too — every major provider, $0 Goblin margin',
      storageLabelCloud('power', 'en'),
      'GitHub push integration',
      'Build from any device',
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="pricing">
      <div className="container">
        <SectionHead
          num="05"
          total="05"
          label="Pricing"
          heading={
            <>
              Simple pricing. <span className="serif-italic">Build anywhere.</span>
            </>
          }
          lead="7-day free trial. No credit card required. Cancel anytime."
        />

        <div className="pricing-grid">
          {PLANS.map((p) => (
            <article key={p.label} className={`price-card${p.recommended ? ' recommended' : ''}`}>
              {p.recommended ? (
                <div className="ribbon">
                  <span className="dot" aria-hidden="true" /> Recommended
                </div>
              ) : null}
              <h3 className="label">{p.label}</h3>
              <div className="tagline">{p.tagline}</div>
              <div className="price-row">
                <span className="price-amount">{p.price}</span>
                <span className="price-suffix">{p.suffix}</span>
              </div>
              <ul className="price-list">
                {p.features.map((f) => (
                  <li key={f}>
                    <span className="check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d={CHECK_PATH} />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/register" className="price-cta">Start free trial</a>
            </article>
          ))}
        </div>

        <p className="pricing-note">
          BYOK users bring their own API keys · Goblin charges $0 extra for inference · Secure checkout via Stripe
        </p>
      </div>
    </section>
  );
}
