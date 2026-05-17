'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'Was ist Goblin?',
    a: 'Goblin ist ein mobiler Vibe-Coding-Workspace: chatte mit AI, sieh den Code live, deploye in einem Schritt — vom Smartphone wie vom Laptop.',
  },
  {
    q: 'Was bedeutet BYOK?',
    a: 'Bring Your Own Key. Du verbindest deinen eigenen API-Key (Anthropic, OpenAI, Google, Groq usw.). Goblin routet Requests zu deinem Provider — du zahlst Inferenz direkt, Goblin verlangt $0 extra dafür.',
  },
  {
    q: 'Welche AI-Provider werden unterstützt?',
    a: 'Anthropic (Claude), OpenAI (GPT), Google (Gemini), Groq, OpenRouter, Mistral und weitere. Du kannst pro Projekt Modelle wählen.',
  },
  {
    q: 'Kann ich jederzeit kündigen?',
    a: 'Ja. In den Billing-Einstellungen → Stripe-Customer-Portal. Sub läuft bis zum Periodenende, dann beendet — kein Auto-Renew danach.',
  },
  {
    q: 'Wo werden meine Daten gespeichert?',
    a: 'Supabase (EU-Region). Code-Files in Supabase Storage, Chat-Verläufe in Postgres. BYOK-Keys werden client-side encrypted gespeichert; Server sieht nur den verschlüsselten Wert.',
  },
  {
    q: 'Was passiert, wenn ich offline bin?',
    a: 'Mobile-App cached deine letzten Projekte. Editor funktioniert offline; AI-Calls und Sync brauchen Internet. Änderungen sync\'en automatisch beim Reconnect.',
  },
];

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--meta)', textDecoration: 'none',
          fontFamily: 'DM Sans, sans-serif', marginBottom: 24,
        }}>
          ← Zurück
        </Link>

        <h1 style={{
          fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 5vw, 40px)',
          color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          Hilfe & Support
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif',
          marginBottom: 40, lineHeight: 1.6,
        }}>
          FAQ, häufige Fragen, und wie du uns erreichst.
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
                    textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
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
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div style={{
          background: 'var(--moss)', color: '#fff',
          borderRadius: 16, padding: '24px 24px 28px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700,
            margin: '0 0 8px',
          }}>
            Noch Fragen?
          </h2>
          <p style={{
            fontSize: 14, opacity: 0.85,
            fontFamily: 'DM Sans, sans-serif', margin: '0 0 18px', lineHeight: 1.5,
          }}>
            Schreib uns direkt — wir antworten innerhalb von 24h.
          </p>
          <a
            href="mailto:support@justgoblin.com"
            style={{
              display: 'inline-block',
              padding: '12px 24px', borderRadius: 24,
              background: 'var(--ochre)', color: 'var(--moss)',
              textDecoration: 'none', fontSize: 14, fontWeight: 600,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            support@justgoblin.com
          </a>
        </div>
      </div>
    </div>
  );
}
