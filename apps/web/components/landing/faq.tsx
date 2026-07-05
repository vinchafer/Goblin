// TODO(LP-3): Legacy LP-1 FAQ kept solely for /pricing. Replace with LP-2
// FAQ once /pricing is restyled to the LP-2 design system. Until then this
// file stays out of the / landing — see components/landing/sections/Faq.tsx.
'use client';
import { useState } from 'react';

const QUESTIONS = [
  {
    q: 'Do I need to know how to code?',
    a: 'No. But if you do know how to code, you’ll love Goblin even more. We show you every line we write and let you edit directly.',
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
    a: 'You get 7 days free — no card required. After that you’ll see an upgrade prompt. Your projects are always safe. If you don’t upgrade, you can still log in, download your code, and push to GitHub.',
  },
  {
    q: 'Is my code private?',
    a: 'Yes. Your projects are only visible to you. All code is stored encrypted at rest in the EU. We never train on your data. Ever.',
  },
  {
    q: 'What happens to my projects if I cancel?',
    a: 'They stay. You can always log back in and push them to GitHub. We won’t delete your work.',
  },
  {
    q: 'Can I use Goblin on my phone?',
    a: 'Yes. That’s the whole point. Build from your bed. Build from the train. Build from wherever you happen to be.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(45,74,43,0.18)',
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
        boxShadow: open
          ? '0 18px 40px -22px rgba(45,74,43,0.30)'
          : '0 6px 18px -12px rgba(45,74,43,0.15)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 24px',
          fontFamily: 'var(--font-sans)', fontSize: 19,
          fontWeight: 700, color: '#0F2A0D', textAlign: 'left', gap: 16,
          letterSpacing: '-0.018em',
          lineHeight: 1.3,
        }}
      >
        {q}
        <span
          style={{
            width: 30, height: 30, borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: open ? '#1F3A1D' : '#F0CF8A',
            color: open ? '#F0CF8A' : '#0F2A0D',
            border: '1px solid ' + (open ? '#0F2A0D' : '#7A5A12'),
            fontSize: 20, fontWeight: 700,
            flexShrink: 0,
            transform: open ? 'rotate(45deg)' : 'none',
            transition: 'all 0.2s',
            lineHeight: 1,
          }}
        >
          +
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 600 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}
      >
        <div
          style={{
            padding: '0 24px 24px',
            borderTop: '1px solid rgba(45,74,43,0.10)',
            marginTop: open ? 0 : -1,
          }}
        >
          <p
            style={{
              fontSize: 15.5,
              color: '#1F3A1D',
              lineHeight: 1.7, margin: '20px 0 0',
              fontWeight: 500, fontFamily: 'var(--font-sans)',
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LandingFaq() {
  return (
    <section
      id="faq"
      style={{
        background: 'var(--paper)',
        padding: '120px 32px',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#1F3A1D', color: '#F0CF8A',
              padding: '6px 14px', borderRadius: 100,
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 22, fontFamily: 'var(--font-sans)',
              boxShadow: '0 4px 12px -4px rgba(31,58,29,0.40)',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0CF8A' }} />
            FAQ
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 'clamp(36px, 4.8vw, 58px)',
              color: '#0F2A0D',
              letterSpacing: '-0.025em',
              margin: 0, lineHeight: 1.05,
            }}
          >
            Questions your goblin{' '}
            <em style={{ fontStyle: 'italic', color: '#7A5A12', fontWeight: 700 }}>
              anticipated.
            </em>
          </h2>
        </div>
        <div>
          {QUESTIONS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

export { LandingFaq as FAQ };
