import { Fragment } from 'react';
import { SectionHead } from '@/components/landing/ui/SectionHead';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// LANDING-MESSAGING v2 · §4.1 — the section that answers "what runs where"
// as ONE statement instead of five scattered hints.
//
// WHY THIS EXISTS. The page already carried the correct sentence ("the AI itself
// runs in Goblin's cloud", the old AiLocationNote). A technical reader from the
// first cohort read the page start to finish and still concluded the model runs
// on his phone. Every string was true; the model a reader assembles from order,
// weight and typography was not. Three things caused it:
//
//   L-1  The load-bearing fact wore the page's ORNAMENT signal. Serif-italic is
//        used throughout for headline flourish ("It ships.", "Code anything.").
//        The one structural fact on the page was set in it, so the eye — trained
//        by eleven other sections — read it as decoration and skipped it.
//        Nothing here is serif-italic except the headline's own flourish, which
//        is where that signal belongs.
//   L-2  The loudest signal in the upper page was the provider strip ("BRING YOUR
//        OWN FRONTIER" + seven vendor names), which sat directly under this
//        answer and contradicted it. Seven proper nouns beat body copy every
//        time. It has moved down to Pricing, where BYOK belongs — after the
//        standard path, not instead of it.
//   L-6  Swift + Forge — the actual answer to "so whose model, and who pays for
//        it?" — first appeared at position 10, in plan bullets. A reader confused
//        at position 2 never arrives there. The answer now sits where the
//        question forms.
//
// Unnumbered by decision D-3: numbering this would force all five section labels
// and every anchor to shift, for no reader benefit. It is a strip, like THE AGENT.
//
// The old AiLocationNote section is absorbed here — its sentence survives as the
// GOBLIN card and the home-screen line below the grid, both in plain set.
//
// U6: the German that was parked in this file now renders on /de — the copy for
// both languages lives in components/landing/copy.ts.

export function Runtime({ lang }: { lang: Lang }) {
  const c = copy(lang).runtime;
  return (
    <section id="runtime" className="runtime">
      <div className="container">
        <SectionHead
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span>
            </>
          }
        />

        <div className="runtime-grid">
          {c.cards.map((card, i) => (
            <Fragment key={card.label}>
              {i > 0 ? (
                <span className="runtime-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
              <article className="runtime-card">
                <div className="label">{card.label}</div>
                <p>{card.body}</p>
              </article>
            </Fragment>
          ))}
        </div>

        <p className="runtime-note">{c.installNote}</p>

        <div className="runtime-models">
          {/* Two spans, not one string: this eyebrow is mono, uppercase and
              letter-spaced, so a single run breaks wherever it runs out of room
              and orphans a word at 375px ("… GOBLIN SWIFT &" / "FORGE"). German
              runs ~20% longer and breaks worse. Each part is unbreakable and the
              em-dash is the only wrap point, so it is one tidy line on desktop
              and two clean ones on a phone — in both languages, without tuning
              font-size per locale. */}
          <div className="runtime-models-eyebrow">
            <span className="part">{c.modelsEyebrowA}</span>
            <span className="dash" aria-hidden="true">—</span>
            <span className="part">{c.modelsEyebrowB}</span>
          </div>
          <p>{c.modelsBody}</p>
        </div>
      </div>
    </section>
  );
}
