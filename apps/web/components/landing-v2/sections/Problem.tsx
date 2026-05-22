import { SectionHead } from '@/components/landing-v2/ui/SectionHead';

const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

const CARDS = [
  {
    num: 'P · 01',
    title: 'Token panic',
    body: 'Claude Pro locks you out after two hours. You count tokens instead of shipping.',
    fix: 'BYOK — pay providers direct',
  },
  {
    num: 'P · 02',
    title: 'Hardware wall',
    body: "Frontier models need 48 GB+ VRAM. Your laptop can't run them locally.",
    fix: 'Build from any device',
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
