import { SectionHead } from '@/components/landing/ui/SectionHead';
import { buildsPerMonth, buildsDefinition } from '@/lib/plan-builds';
import { storageLabelCloud } from '@/lib/plan-storage';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

/**
 * Display order and the numbers. The copy file carries the labels and taglines
 * and never a figure; build allowances and storage come from lib/plan-builds.ts
 * and lib/plan-storage.ts. Iterating THIS array rather than the copy array is
 * deliberate — a price must never be able to render blank because a translation
 * was short an entry.
 */
const PLAN_SPECS: { key: 'build' | 'pro' | 'power'; price: string; recommended?: boolean }[] = [
  { key: 'build', price: '$11' },
  { key: 'pro', price: '$19', recommended: true },
  { key: 'power', price: '$39' },
];

export function Pricing({ lang }: { lang: Lang }) {
  const c = copy(lang).pricing;
  // Prices, build allowances and storage come from their single sources
  // (lib/plan-builds.ts, lib/plan-storage.ts) — never restated in the copy file.
  const features = (key: (typeof PLAN_SPECS)[number]['key']) => [
    c.features.bundled,
    buildsPerMonth(key, lang),
    c.features.projects,
    c.features.byok,
    storageLabelCloud(key, lang),
    c.features.github,
    c.features.anyDevice,
  ];

  return (
    <section id="pricing" className="pricing">
      <div className="container">
        <SectionHead
          num="05"
          total="05"
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span>
            </>
          }
          lead={c.lead}
        />

        <div className="pricing-grid">
          {PLAN_SPECS.map((spec, i) => {
            // copy.parity.test.ts holds both languages at three plans, so this
            // never falls through — the guard is what makes that guarantee
            // explicit instead of an index cast.
            const plan = c.plans[i];
            if (!plan) return null;
            return (
              <article key={spec.key} className={`price-card${spec.recommended ? ' recommended' : ''}`}>
                {spec.recommended ? (
                  <div className="ribbon">
                    <span className="dot" aria-hidden="true" /> {c.recommended}
                  </div>
                ) : null}
                <h3 className="label">{plan.label}</h3>
                <div className="tagline">{plan.tagline}</div>
                <div className="price-row">
                  <span className="price-amount">{spec.price}</span>
                  <span className="price-suffix">{c.perMonth}</span>
                </div>
                <ul className="price-list">
                  {features(spec.key).map((f) => (
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
                <a href="/register" className="price-cta">{c.cta}</a>
              </article>
            );
          })}
        </div>

        {/* TESTER-FEEDBACK (2026-08-17): "Pricing speaks of builds and I cannot
            tell what a build is." The definition comes from the metering source
            (lib/plan-builds.ts documents which one) and lives in exactly one
            place, so pricing and the ledger cannot drift apart in words either. */}
        <p className="pricing-note pricing-builds-def">{buildsDefinition(lang)}</p>

        <p className="pricing-note">{c.note}</p>
      </div>
    </section>
  );
}
