'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SupportChat } from '@/components/support/support-chat';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { HELP_ARTICLES } from '@goblin/shared/src/help-content';
import { useLang, t, type Lang } from '@/lib/use-lang';
import { emitEvent } from '@/lib/api';

export default function HelpPage() {
  const lang = useLang();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // I1 funnel: help_opened — a user reached the help/support surface (a friction
  // signal). Once per mount, metadata only.
  useEffect(() => {
    emitEvent('help_opened', { surface: 'index' });
  }, []);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--meta)', textDecoration: 'none',
          fontFamily: 'var(--font-sans)', marginBottom: 24, minHeight: 44,
        }}>
          {t(lang, '← Zurück', '← Back')}
        </Link>

        <h1 style={{
          fontFamily: 'var(--font-sans)', fontSize: 'clamp(28px, 5vw, 40px)',
          color: 'var(--text)', fontWeight: 700, letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          {t(lang, 'Hilfe', 'Help')}
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--meta)', fontFamily: 'var(--font-sans)',
          marginBottom: 32, lineHeight: 1.6,
        }}>
          {t(lang, 'Verständliche Anleitungen — und ein Hilfe-Agent, der sofort antwortet.', 'Clear guides — and a help agent that answers instantly.')}
        </p>

        {/* Article index */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
          {HELP_ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/help/${a.slug}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', minHeight: 56,
                background: 'var(--panel, #fff)', border: '1px solid var(--border)',
                borderRadius: 12, textDecoration: 'none', fontFamily: 'var(--font-sans)',
              }}
            >
              <span aria-hidden style={{ fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{a.title[lang]}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--meta)', marginTop: 2, lineHeight: 1.4 }}>{a.summary[lang]}</span>
              </span>
              <span aria-hidden style={{ color: 'var(--meta)', fontSize: 18, flexShrink: 0 }}>›</span>
            </Link>
          ))}
        </div>

        {/* Contact CTA — Goblin Hilfe agent */}
        <HelpAgentCTA lang={lang} />

        {/* Feedback affordance */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            data-testid="help-feedback"
            onClick={() => setFeedbackOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', minHeight: 44,
              color: 'var(--meta)', fontSize: 13, fontFamily: 'var(--font-sans)', textDecoration: 'underline',
            }}
          >
            {t(lang, 'Feedback geben', 'Give feedback')}
          </button>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} surface="help" />
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
