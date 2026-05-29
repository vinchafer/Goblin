'use client';

import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { Globe, ListChecks, CalendarDays, KeyRound } from 'lucide-react';

interface EmptyChatProps {
  userName: string;
  onSuggestionClick: (prompt: string) => void;
}

// Suggestions in plain user language — not dev jargon. Each describes
// what the *result* is, not what tech sits behind it. Icons are lucide
// glyphs, each semantically distinct (no emoji in product UI, §A6).
const SUGGESTIONS = [
  { Icon: Globe,        text: 'Eine Landingpage mit Anmeldeformular' },
  { Icon: ListChecks,   text: 'Eine Aufgabenliste, die meine Einträge merkt' },
  { Icon: CalendarDays, text: 'Eine Seite, auf der Leute Termine buchen können' },
  { Icon: KeyRound,     text: 'Magic-Link-Login für meine Next.js-App' },
];

// Screen 04 — empty state of a standalone chat. Calm, centered: one idle
// mark, one greeting line, four suggestion pills that prefill the composer.
// No hero card (that is screen-03 exclusive), no eyebrow, no subtitle.
export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 640,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Idle brand mark — Ink Deep on the bone field (§B1.4 reversed-on-warm). */}
        <GoblinLogo state="idle" size={48} variant="ink" />

        <h2 style={{
          fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
          fontWeight: 600,
          fontSize: 'var(--t-h2-fs)',
          lineHeight: 'var(--t-h2-lh)',
          letterSpacing: 'var(--t-h2-ls)',
          color: 'var(--ink-1)',
          textAlign: 'center',
          margin: '8px 0 0',
        }}>
          Leg los.
        </h2>

        {/* Suggestion pills — flex-wrap; the chips ARE the tip (no subtitle). */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          justifyContent: 'center', marginTop: 24,
        }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s.text}
              type="button"
              onClick={() => onSuggestionClick(s.text)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--surface-1)', border: '1px solid var(--rule)',
                borderRadius: 9999, padding: '8px 14px',
                fontSize: 'var(--t-small-fs)', color: 'var(--ink-1)',
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)'; }}
            >
              <s.Icon size={16} />
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
