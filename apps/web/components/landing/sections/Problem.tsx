import { SectionHead } from '@/components/landing/ui/SectionHead';

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
// LANGUAGE NOTE: static English landing (see app/page.tsx). Founder-authored
// German for the changed card, ready for localization:
//   P·02 — "Laptop-Zwang": "Bevor du eine Zeile schreibst, brauchst du einen
//   eingerichteten Entwicklerrechner. Laufzeit, Toolchain, Keys, alles."

const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

const CARDS = [
  {
    num: 'P · 01',
    title: 'Token panic',
    body: 'Frontier subscriptions cut you off mid-session. You count tokens instead of shipping.',
    fix: 'Bundled, not metered',
  },
  {
    num: 'P · 02',
    title: 'Laptop lock-in',
    body: 'Before you write a line, you need a set-up developer machine. Runtime, toolchain, keys, the lot.',
    fix: 'A browser is the whole requirement',
  },
  {
    num: 'P · 03',
    title: 'Copy-paste hell',
    body: 'Chat, copy, switch, paste, find the file. Every. Single. Time.',
    fix: 'One-tap Send to Code',
  },
  {
    num: 'P · 04',
    title: 'IDE overwhelm',
    body: "Cursor and VS Code weren't built for builders who just want to ship fast.",
    fix: 'Focused builder UI',
  },
];

export function Problem() {
  return (
    <section id="why" className="problem">
      <div className="container">
        <SectionHead
          num="01"
          total="05"
          label="The Problem"
          heading={
            <>
              Building with AI
              <br />
              <span className="serif-italic">shouldn&apos;t feel like this.</span>
            </>
          }
          lead="Four walls every builder hits. Goblin removes all of them."
        />

        <div className="problem-grid">
          {CARDS.map((c) => (
            <article key={c.num} className="problem-card">
              <div className="head">
                <span className="num">{c.num}</span>
                <span className="rule" aria-hidden="true" />
              </div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <div className="fix">
                <span className="tick" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d={CHECK_PATH} />
                  </svg>
                </span>
                {c.fix}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
