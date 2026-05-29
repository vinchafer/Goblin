'use client';

import { useState } from 'react';
import { SupportChat } from '../support/support-chat';

interface Faq { q: string; a: string }

const FAQS: Faq[] = [
  { q: 'Was ist Goblin?', a: 'Goblin ist ein mobiler Vibe-Coding-Workspace: chatte mit AI, sieh den Code live, deploye in einem Schritt — vom Smartphone wie vom Laptop.' },
  { q: 'Was bedeutet BYOK?', a: 'Bring Your Own Key. Du verbindest deinen eigenen API-Key (Anthropic, OpenAI, Google, Groq usw.). Goblin routet Requests zu deinem Provider — du zahlst Inferenz direkt, Goblin verlangt $0 extra dafür.' },
  { q: 'Welche AI-Provider werden unterstützt?', a: 'Anthropic (Claude), OpenAI (GPT), Google (Gemini), Groq, OpenRouter, Mistral und weitere. Du kannst pro Projekt Modelle wählen.' },
  { q: 'Wie funktioniert Send to Code?', a: 'In der Chat-Ansicht tippst du auf "Send to Code" und der vorgeschlagene Patch wird direkt in den Editor übernommen — ohne Copy-Paste.' },
  { q: 'Wie pushe ich zu GitHub?', a: 'Verbinde GitHub einmalig in Konnektoren. Dann pusht jedes "Save" automatisch auf einen Branch deiner Wahl.' },
  { q: 'Kann ich jederzeit kündigen?', a: 'Ja. Settings → Abrechnung → Plan verwalten öffnet das Stripe-Customer-Portal. Sub läuft bis zum Periodenende.' },
  { q: 'Wo werden meine Daten gespeichert?', a: 'Supabase (EU-Region). Code-Files in Supabase Storage, Chat-Verläufe in Postgres. BYOK-Keys werden verschlüsselt gespeichert.' },
  { q: 'Was passiert, wenn ich offline bin?', a: 'Editor cached deine letzten Projekte. AI-Calls und Sync brauchen Internet. Änderungen syncen beim Reconnect.' },
];

export function HelpCenterPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const filtered = query
    ? FAQS.filter(f => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase()))
    : FAQS;

  return (
    <div style={{ padding: '0 16px 96px', fontFamily: 'var(--font-sans)', position: 'relative' }}>
      <input
        type="search"
        placeholder="Wonach suchst du?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%', padding: '12px 16px',
          background: 'var(--subtle)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, color: 'var(--text)', fontSize: 15,
          fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 16,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((f, i) => {
          const open = openIdx === i;
          return (
            <div key={f.q} style={{
              background: 'var(--panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <button onClick={() => setOpenIdx(open ? null : i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'var(--font-sans)',
                fontSize: 15, fontWeight: 500, color: 'var(--text)',
              }}>
                <span>{f.q}</span>
                <span style={{ color: 'var(--text-meta)', fontSize: 16, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
              </button>
              {open && (
                <div style={{ padding: '0 16px 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
                  {f.a}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-meta)', fontSize: 14 }}>
            Keine Treffer. Frag direkt unten den Goblin-Assistenten.
          </p>
        )}
      </div>

      <div style={{
        position: 'sticky', bottom: 16, marginTop: 24, zIndex: 5,
      }}>
        <button
          onClick={() => setChatOpen(true)}
          data-testid="open-support-chat"
          style={{
            width: '100%', padding: '14px 20px',
            background: 'var(--brand-green)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
            justifyContent: 'center', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          Frag den Goblin-Assistenten
        </button>
      </div>

      {chatOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'var(--surface-overlay)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setChatOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 560, height: '90dvh',
            background: 'var(--panel)', borderTopLeftRadius: 'var(--radius-sheet)', borderTopRightRadius: 'var(--radius-sheet)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <SupportChat onClose={() => setChatOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
