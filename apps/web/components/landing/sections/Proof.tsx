import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// Trust strip on the public landing (justgoblin.com).
//
// Sprint 12 (fix 1C): the old strip spoke in PITCH/investor voice — raw
// commit/LOC/E2E/founder counts and "Poke at every claim." That is language for
// investors, not for the non-technical builder who lands here. Replaced with a
// lean, warm trust line in the landing's own voice: Goblin is a real, working
// product you can build with today — no numbers to prove, no challenge to issue.
//
// U6: the DE variant that the old header called "pending" now exists and renders
// on /de — see components/landing/copy.ts.

export function Proof({ lang }: { lang: Lang }) {
  const c = copy(lang).proof;
  return (
    <section className="proof">
      <div className="proof-inner">
        <div className="proof-head">
          {c.head.a} <span className="serif-italic">{c.head.i}</span>
        </div>
        <p className="proof-foot">{c.foot}</p>
      </div>
    </section>
  );
}
