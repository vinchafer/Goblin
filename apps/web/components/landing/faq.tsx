'use client';
import { useState } from 'react';

const QUESTIONS = [
  {
    q: "Do I need to know how to code?",
    a: "No. But if you do know how to code, you'll love Goblin even more. We show you every line we write and let you edit directly."
  },
  {
    q: "Can I use my own Claude or OpenAI keys?",
    a: "Yes, absolutely. Go to Settings → API Keys and paste your key. We encrypt it at rest and use it exclusively for your requests. No markup, no middleman."
  },
  {
    q: "Is my code private?",
    a: "Yes. Your projects are only visible to you. All code is stored encrypted at rest on Hetzner servers in Frankfurt (GDPR). We never train on your data. Ever."
  },
  {
    q: "What happens to my projects if I cancel?",
    a: "They stay. You can always log back in and push them to GitHub. We won't delete your work."
  },
  {
    q: "Where exactly is my code stored?",
    a: "Encrypted at rest on Hetzner servers in Frankfurt, Germany. We use Supabase Postgres for metadata and S3-compatible object storage for your files. GDPR compliant."
  },
  {
    q: "Can I use Goblin on my phone?",
    a: "Yes. That's the whole point. Build from your bed. Build from the train. Build from wherever you happen to be."
  }
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 0', fontFamily: 'Fraunces, serif', fontSize: 18,
          fontWeight: 700, color: 'var(--bark)', textAlign: 'left', gap: 16,
        }}
      >
        {q}
        <span style={{ fontSize: 20, color: 'var(--meta)', flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
      </button>
      <div style={{
        maxHeight: open ? 300 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease',
      }}>
        <p style={{ fontSize: 14, color: 'var(--meta)', lineHeight: 1.7, paddingBottom: 20, fontWeight: 300 }}>{a}</p>
      </div>
    </div>
  );
}

export function LandingFaq() {
  return (
    <section id="faq" style={{ background: 'var(--cream)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, textAlign: 'center', marginBottom: 56, fontSize: 'clamp(24px, 4vw, 40px)', color: 'var(--bark)' }}>
          Questions your goblin anticipated.
        </h2>
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
