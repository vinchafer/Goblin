import { SectionHead } from '@/components/landing/ui/SectionHead';

// D-1: the dedicated "agent" section — the single differentiator competitors
// can't copy. Reuses the how-card grid pattern (no new CSS, design tokens only).
//
// LANGUAGE NOTE: the marketing landing is a static English page (see app/page.tsx
// — every section is English, there is no i18n mechanism on the landing). This
// section therefore RENDERS the English copy, to stay consistent with the eleven
// sections around it. The founder authored D-1's content in German; that exact
// German is preserved here in `de` so it is not lost and is ready the day the
// landing is localized. It does not render today. Localizing the whole landing
// is separate, larger work (a founder decision, flagged in the PR).
//
// Every step maps to a live orchestrator capability (verified against
// apps/api/src/services/agent/orchestrator.ts + tools.ts):
//   Plan             → the `plan` tool
//   Writes the files → the `write_file` / `save_draft` tools
//   Checks its own work → bounded correction loop (MAX_HEAL_CYCLES = 2) + publish-gate
//                        repair, and an honest report when the budget is spent
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
//   Goes live        → the `publish` tool, gated on explicit go-ahead
//                      (publishGranted), confirming the attested live URL
const STEPS = [
  {
    num: '01',
    en: { title: 'Plan', body: 'It reads your request and lays out a plan before it touches a single file.' },
    de: { title: 'Plan', body: 'Es liest deine Anfrage und legt einen Plan fest, bevor es eine einzige Datei anfasst.' },
  },
  {
    num: '02',
    en: { title: 'Writes the files', body: 'It writes and edits the files in your project directly — not snippets for you to copy.' },
    de: { title: 'Schreibt Dateien', body: 'Es schreibt und ändert die Dateien in deinem Projekt direkt — keine Schnipsel zum Kopieren.' },
  },
  {
    num: '03',
    en: { title: 'Checks its own work', body: 'It verifies what it built, corrects what it can, and tells you plainly when something is still broken.' },
    de: { title: 'Prüft die eigene Arbeit', body: 'Es prüft, was es gebaut hat, korrigiert, was es kann — und sagt klar, wenn etwas kaputt bleibt.' },
  },
  {
    num: '04',
    en: { title: 'Goes live', body: 'On your go-ahead it publishes — and confirms the live URL when it is up.' },
    de: { title: 'Stellt live', body: 'Auf dein Okay stellt es live — und bestätigt die Live-URL, sobald sie steht.' },
  },
];

// Rendered language for the landing (see LANGUAGE NOTE above).
const LEAD = {
  en: 'You see every step — and take over anytime.',
  de: 'Du siehst jeden Schritt — und übernimmst jederzeit.',
};

export function AgentFlow() {
  return (
    <section id="agent" className="how">
      <div className="container">
        <SectionHead
          label="The agent"
          heading={
            <>
              Your agent builds it — <span className="serif-italic">end to end.</span>
            </>
          }
          lead={LEAD.en}
        />
        <div className="how-grid">
          {STEPS.map((s) => (
            <article key={s.num} className="how-card">
              <div className="step">
                <span className="num">{s.num}</span>
                <span>Step</span>
              </div>
              <h3>{s.en.title}</h3>
              <p>{s.en.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
