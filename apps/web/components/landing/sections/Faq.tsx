import { SectionHead } from '@/components/landing/ui/SectionHead';

const ITEMS = [
  {
    q: 'Do I need to know how to code?',
    a: "No. But if you do know how to code, you'll love Goblin even more. We show you every line we write and let you edit directly.",
  },
  {
    q: 'Can I use my own Claude or OpenAI keys?',
    a: 'Yes. Go to Settings → API Keys and paste your key. We encrypt it at rest and use it exclusively for your requests. No markup, no middleman.',
  },
  {
    q: 'What AI models can I use?',
    a: 'Two Goblin models are built into every plan — Goblin Swift (fast, efficient) and Goblin Forge (for heavier work). No API key, no per-token counter. Want the absolute frontier? Bring your own Anthropic, OpenAI, Google, xAI, Mistral, or DeepSeek key — Goblin takes no margin on it.',
  },
  {
    q: 'What happens after my trial?',
    a: "3 days free, no card required. After that you'll see an upgrade prompt. Your projects are always safe. If you don't upgrade, you can still log in, download your code, and push to GitHub.",
  },
  {
    q: 'Is my code private?',
    a: 'Yes. Your projects are only visible to you, stored encrypted at rest in the EU. We never train on your data.',
  },
  {
    q: 'Can I use Goblin on my phone?',
    a: "Yes. That's the whole point. Build from your bed. Build from the train. Build from wherever you happen to be.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="faq">
      <div className="container">
        <SectionHead
          label="FAQ"
          heading={
            <>
              Questions your goblin <span className="serif-italic">anticipated.</span>
            </>
          }
          style={{ marginBottom: 48 }}
        />
        <div className="faq-list">
          {ITEMS.map((it) => (
            <details key={it.q} className="faq-item">
              <summary className="faq-toggle">
                {it.q}
                <span className="plus" aria-hidden="true" />
              </summary>
              <div className="faq-answer">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
