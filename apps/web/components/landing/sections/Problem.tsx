import { SectionHead } from '@/components/landing/ui/SectionHead';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// LANDING-MESSAGING v2 · L-4 / D-4.
//
// P·02 was "Hardware wall" ("Frontier models need 48 GB+ VRAM"). Everything in
// Goblin runs on Goblin's servers, so raw compute was never the wall a reader
// hits — but stating it as one laid a false trail that the rest of the page then
// had to fight: a technical reader who reads "hardware wall" starts asking what
// his phone has to be powerful enough for. The real wall is a SET-UP developer
// machine, and that is the one Goblin actually removes.
//
// P·01 named a third-party plan and a concrete limit ("Claude Pro locks you out
// after two hours"). Those limits change per plan and over time, so the sentence
// asserts a state this page cannot verify and would silently rot. The pain is
// real and is kept; the unverifiable specifics are gone.
//
// U6: copy (both languages) now lives in components/landing/copy.ts.

const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

export function Problem({ lang }: { lang: Lang }) {
  const c = copy(lang).problem;
  return (
    <section id="why" className="problem">
      <div className="container">
        <SectionHead
          num="01"
          total="05"
          label={c.label}
          heading={
            <>
              {c.head.a}
              <br />
              <span className="serif-italic">{c.head.i}</span>
            </>
          }
          lead={c.lead}
        />

        <div className="problem-grid">
          {c.cards.map((card) => (
            <article key={card.num} className="problem-card">
              <div className="head">
                <span className="num">{card.num}</span>
                <span className="rule" aria-hidden="true" />
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <div className="fix">
                <span className="tick" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d={CHECK_PATH} />
                  </svg>
                </span>
                {card.fix}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
