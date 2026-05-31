'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SupportChat } from '@/components/support/support-chat';

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'What is Goblin?',
    a: 'Goblin is a mobile vibe-coding workspace: chat with AI, watch the code live, and deploy in one step — from your phone or your laptop.',
  },
  {
    q: 'What does BYOK mean?',
    a: 'Bring Your Own Key. You connect your own API key (Anthropic, OpenAI, Google, Groq, and so on). Goblin routes requests to your provider — you pay for inference directly, and Goblin charges $0 extra for it.',
  },
  {
    q: 'Which AI providers are supported?',
    a: 'Anthropic (Claude), OpenAI (GPT), Google (Gemini), Groq, OpenRouter, Mistral, and more. You can choose models per project.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Go to Billing settings → Stripe customer portal. Your subscription runs until the end of the period, then ends — no auto-renew after that.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Supabase (EU region). Code files in Supabase Storage, chat history in Postgres. BYOK keys are stored client-side encrypted; the server only ever sees the encrypted value.',
  },
  {
    q: 'What happens when I\'m offline?',
    a: 'The mobile app caches your recent projects. The editor works offline; AI calls and sync need a connection. Your changes sync automatically when you reconnect.',
  },
];

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--meta)', textDecoration: 'none',
          fontFamily: 'var(--font-sans)', marginBottom: 24,
        }}>
          ← Back
        </Link>

        <h1 style={{
          fontFamily: 'var(--font-sans)', fontSize: 'clamp(28px, 5vw, 40px)',
          color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          Help & Support
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--meta)', fontFamily: 'var(--font-sans)',
          marginBottom: 40, lineHeight: 1.6,
        }}>
          FAQs and how to reach us.
        </p>

        {/* FAQ Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <div key={i} style={{
                background: 'var(--panel, #fff)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenIdx(open ? null : i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'var(--font-sans)',
                    fontSize: 15, fontWeight: 500, color: 'var(--text)',
                    minHeight: 56,
                  }}
                >
                  <span>{f.q}</span>
                  <span style={{ color: 'var(--meta)', fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
                </button>
                {open && (
                  <div style={{
                    padding: '0 20px 18px', fontSize: 14,
                    lineHeight: 1.65, color: 'var(--text-2, var(--meta))',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact CTA — Goblin help agent */}
        <HelpAgentCTA />
      </div>
    </div>
  );
}

function HelpAgentCTA() {
  const [chatOpen, setChatOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  return (
    <div style={{
      background: 'var(--brand-green)', color: '#fff',
      borderRadius: 16, padding: '24px 24px 28px',
      textAlign: 'center',
    }}>
      <h2 style={{
        fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700,
        margin: '0 0 8px',
      }}>
        Still have questions?
      </h2>
      <p style={{
        fontSize: 14, opacity: 0.85,
        fontFamily: 'var(--font-sans)', margin: '0 0 18px', lineHeight: 1.5,
      }}>
        The Goblin help agent knows the product and answers instantly.
      </p>
      <button
        onClick={() => setChatOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', borderRadius: 24,
          background: 'var(--brand-gold)', color: 'var(--brand-green)',
          textDecoration: 'none', fontSize: 14, fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          border: 'none', cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        Chat with Goblin help
      </button>
      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
        {!escalateOpen ? (
          <button
            onClick={() => setEscalateOpen(true)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, fontFamily: 'var(--font-sans)' }}
          >
            I'm stuck — I need a human
          </button>
        ) : (
          <span>Type &ldquo;human&rdquo; in the chat and the agent escalates automatically.</span>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, fontFamily: 'var(--font-sans)' }}>
        Or by email:{' '}
        <a href="mailto:support@justgoblin.com" style={{ color: 'rgba(255,255,255,0.92)', textDecoration: 'underline' }}>
          support@justgoblin.com
        </a>
      </div>

      {chatOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setChatOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 560, height: '90dvh',
            background: 'var(--panel)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <SupportChat onClose={() => setChatOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
