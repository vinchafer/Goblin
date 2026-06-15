'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SupportChat } from '@/components/support/support-chat';
import { useLang, t, type Lang } from '@/lib/use-lang';

interface Faq {
  q: string;
  a: string;
}

// WS-C: the help page was hardcoded English while the app defaults to German
// (useLang → 'de'), so a DE user saw an all-English page. Now bilingual via the
// shared i18n hook — same source of truth as the rest of the app.
function faqs(lang: Lang): Faq[] {
  return [
    {
      q: t(lang, 'Was ist Goblin?', 'What is Goblin?'),
      a: t(lang,
        'Goblin ist ein mobiler Vibe-Coding-Arbeitsplatz: Chatte mit der KI, sieh dem Code live beim Entstehen zu und deploye in einem Schritt – vom Handy oder vom Laptop.',
        'Goblin is a mobile vibe-coding workspace: chat with AI, watch the code live, and deploy in one step — from your phone or your laptop.'),
    },
    {
      q: t(lang, 'Was bedeutet BYOK?', 'What does BYOK mean?'),
      a: t(lang,
        'Bring Your Own Key – dein eigener Schlüssel. Du verbindest deinen eigenen API-Schlüssel (Anthropic, OpenAI, Google, Groq usw.). Goblin leitet Anfragen an deinen Anbieter weiter – du zahlst die Inferenz direkt, und Goblin verlangt dafür 0 $ extra.',
        'Bring Your Own Key. You connect your own API key (Anthropic, OpenAI, Google, Groq, and so on). Goblin routes requests to your provider — you pay for inference directly, and Goblin charges $0 extra for it.'),
    },
    {
      q: t(lang, 'Welche KI-Anbieter werden unterstützt?', 'Which AI providers are supported?'),
      a: t(lang,
        'Anthropic (Claude), OpenAI (GPT), Google (Gemini), Groq, OpenRouter, Mistral und mehr. Du kannst die Modelle pro Projekt wählen.',
        'Anthropic (Claude), OpenAI (GPT), Google (Gemini), Groq, OpenRouter, Mistral, and more. You can choose models per project.'),
    },
    {
      q: t(lang, 'Kann ich jederzeit kündigen?', 'Can I cancel anytime?'),
      a: t(lang,
        'Ja. Geh zu den Abrechnungs-Einstellungen → Stripe-Kundenportal. Dein Abo läuft bis zum Ende der Periode und endet dann – danach keine automatische Verlängerung.',
        'Yes. Go to Billing settings → Stripe customer portal. Your subscription runs until the end of the period, then ends — no auto-renew after that.'),
    },
    {
      q: t(lang, 'Wo werden meine Daten gespeichert?', 'Where is my data stored?'),
      a: t(lang,
        'Supabase (EU-Region). Code-Dateien im Supabase-Storage, Chat-Verlauf in Postgres. BYOK-Schlüssel werden clientseitig verschlüsselt gespeichert; der Server sieht immer nur den verschlüsselten Wert.',
        'Supabase (EU region). Code files in Supabase Storage, chat history in Postgres. BYOK keys are stored client-side encrypted; the server only ever sees the encrypted value.'),
    },
    {
      q: t(lang, 'Was passiert, wenn ich offline bin?', 'What happens when I\'m offline?'),
      a: t(lang,
        'Die mobile App speichert deine letzten Projekte zwischen. Der Editor funktioniert offline; KI-Aufrufe und die Synchronisierung brauchen eine Verbindung. Deine Änderungen werden automatisch synchronisiert, sobald du wieder online bist.',
        'The mobile app caches your recent projects. The editor works offline; AI calls and sync need a connection. Your changes sync automatically when you reconnect.'),
    },
  ];
}

export default function HelpPage() {
  const lang = useLang();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const FAQS = faqs(lang);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--meta)', textDecoration: 'none',
          fontFamily: 'var(--font-sans)', marginBottom: 24,
        }}>
          {t(lang, '← Zurück', '← Back')}
        </Link>

        <h1 style={{
          fontFamily: 'var(--font-sans)', fontSize: 'clamp(28px, 5vw, 40px)',
          color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          {t(lang, 'Hilfe & Support', 'Help & Support')}
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--meta)', fontFamily: 'var(--font-sans)',
          marginBottom: 40, lineHeight: 1.6,
        }}>
          {t(lang, 'Häufige Fragen und wie du uns erreichst.', 'FAQs and how to reach us.')}
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
                    padding: '0 20px 18px', fontSize: 'var(--t-small-fs)',
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
        <HelpAgentCTA lang={lang} />
      </div>
    </div>
  );
}

function HelpAgentCTA({ lang }: { lang: Lang }) {
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
        {t(lang, 'Noch Fragen?', 'Still have questions?')}
      </h2>
      <p style={{
        fontSize: 'var(--t-small-fs)', opacity: 0.85,
        fontFamily: 'var(--font-sans)', margin: '0 0 18px', lineHeight: 1.5,
      }}>
        {t(lang, 'Der Goblin-Hilfe-Agent kennt das Produkt und antwortet sofort.', 'The Goblin help agent knows the product and answers instantly.')}
      </p>
      <button
        onClick={() => setChatOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', borderRadius: 24,
          background: 'var(--brand-gold)', color: 'var(--brand-green)',
          textDecoration: 'none', fontSize: 'var(--t-small-fs)', fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          border: 'none', cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        {t(lang, 'Mit dem Goblin-Hilfe-Agenten chatten', 'Chat with Goblin help')}
      </button>
      <div style={{ marginTop: 14, fontSize: 'var(--t-caption-fs)', opacity: 0.7 }}>
        {!escalateOpen ? (
          <button
            onClick={() => setEscalateOpen(true)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-sans)' }}
          >
            {t(lang, 'Ich komme nicht weiter – ich brauche einen Menschen', "I'm stuck — I need a human")}
          </button>
        ) : (
          <span>{t(lang, 'Schreib „Mensch“ in den Chat und der Agent leitet automatisch an einen Menschen weiter.', 'Type “human” in the chat and the agent escalates automatically.')}</span>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 'var(--t-caption-fs)', opacity: 0.7, fontFamily: 'var(--font-sans)' }}>
        {t(lang, 'Oder per E-Mail:', 'Or by email:')}{' '}
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
