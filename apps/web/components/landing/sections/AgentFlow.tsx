import { SectionHead } from '@/components/landing/ui/SectionHead';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// D-1: the dedicated "agent" section — the single differentiator competitors
// can't copy. Reuses the how-card grid pattern (no new CSS, design tokens only).
//
// Every step maps to a live orchestrator capability (verified against
// apps/api/src/services/agent/orchestrator.ts + tools.ts):
//   Plan                → the `plan` tool
//   Writes the files    → the `write_file` / `save_draft` tools
//   Checks its own work → bounded correction loop (MAX_HEAL_CYCLES = 2) +
//                         publish-gate repair, and an honest report when the
//                         budget is spent
//   Goes live           → the `publish` tool, gated on explicit go-ahead
//                         (publishGranted), confirming the attested live URL
//
// LANDING-MESSAGING v2 · D-5. Two changes to step 03, one per question the
// decision asked:
//   (a) "self-heal" is the Ops-Master-Plan's K3 term, reserved until Hire-1. It
//       was being spent here on the build agent's retry loop. Renamed; the term
//       goes back to Keeper K3.
//   (b) The old body ("fixes what failed before it hands anything back") asserted
//       SUCCESS. The loop is bounded at MAX_HEAL_CYCLES = 2 and exhaustion is a
//       real outcome the run surfaces honestly (orchestrator.ts:501-509,
//       components/code/AgentRunView.tsx:238). A landing that promises the fix
//       always lands would be contradicted by the product's own honest failure
//       message. The claim now matches the bound: it corrects what it can and
//       says so when it cannot.
//
// U6: this section carried the landing's first `de` block, kept alongside `en`
// against the day the landing was localized. That day is here — the German moved
// verbatim into components/landing/copy.ts and now renders on /de.

export function AgentFlow({ lang }: { lang: Lang }) {
  const c = copy(lang).agent;
  return (
    <section id="agent" className="how">
      <div className="container">
        <SectionHead
          label={c.label}
          heading={
            <>
              {c.head.a} <span className="serif-italic">{c.head.i}</span>
            </>
          }
          lead={c.lead}
        />
        <div className="how-grid">
          {c.steps.map((s, i) => (
            <article key={s.title} className="how-card">
              <div className="step">
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <span>{c.step}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
