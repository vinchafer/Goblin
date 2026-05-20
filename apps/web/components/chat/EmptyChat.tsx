'use client';

import { GoblinMark } from '@/components/ui/goblin-mark';
import { getGreeting } from '@/lib/greeting';

interface EmptyChatProps {
  userName: string;
  onSuggestionClick: (prompt: string) => void;
}

const SUGGESTIONS = [
  'Eine Landing Page mit Hero und CTA',
  'Einen REST-Endpoint der JSON liefert',
  'Eine Aufgabenliste mit lokalem Speicher',
];

export function EmptyChat({ userName, onSuggestionClick }: EmptyChatProps) {
  const greeting = getGreeting(userName);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '48px 16px 16px',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <GoblinMark size={48} />

      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <h1 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(22px, 4vw, 28px)',
          fontWeight: 400,
          color: 'var(--text)',
          letterSpacing: '-0.3px',
          margin: '0 0 8px',
        }}>
          {greeting}
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--meta)',
          lineHeight: 1.5,
          margin: 0,
        }}>
          Beschreib deine Idee — oder starte mit einem Vorschlag.
        </p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: 360,
      }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            style={{
              padding: '12px 14px',
              background: 'var(--panel)',
              border: '1px solid var(--div)',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text)',
              textAlign: 'left',
              fontFamily: 'var(--font-ui)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--moss)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--div)'; }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
