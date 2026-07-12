'use client';

import { useEffect, useState } from 'react';
import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { Globe, ListChecks, CalendarDays, KeyRound } from 'lucide-react';
import { useLang, t } from '@/lib/use-lang';

interface EmptyChatProps {
  userName: string;
  onSuggestionClick: (prompt: string) => void;
}

// Suggestions in plain user language — not dev jargon. Each describes
// what the *result* is, not what tech sits behind it. Icons are lucide
// glyphs, each semantically distinct (no emoji in product UI, §A6).
// Bilingual (D-3): the label both renders and prefills the composer, so the
// same language the user chose flows into the prompt they send.
const SUGGESTIONS = [
  { Icon: Globe,        de: 'Eine Landingpage mit Anmeldeformular',        en: 'A landing page with a signup form' },
  { Icon: ListChecks,   de: 'Eine Aufgabenliste, die meine Einträge merkt', en: 'A to-do list that remembers my entries' },
  { Icon: CalendarDays, de: 'Eine Seite, auf der Leute Termine buchen können', en: 'A page where people can book appointments' },
  { Icon: KeyRound,     de: 'Magic-Link-Login für meine Next.js-App',      en: 'Magic-link login for my Next.js app' },
];

// Screen 04 — empty state of a standalone chat. Calm, centered: one idle
// mark, one greeting line, four suggestion pills that prefill the composer.
// No hero card (that is screen-03 exclusive), no eyebrow, no subtitle.
export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  const lang = useLang();
  // Chips read oversized on ~390px phones; tighten padding/font/icon below
  // 640px only. Desktop (built_04_v2 spec) is unchanged. matchMedia matches
  // the responsive pattern already used across the dashboard (Sidebar etc.).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

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
        {/* Idle brand mark — brand green on the bone field (founder: one green-logo chat). */}
        <GoblinLogo state="idle" size={48} variant="green" />

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
          {t(lang, 'Leg los.', "Let's go.")}
        </h2>

        {/* Suggestion pills — flex-wrap; the chips ARE the tip (no subtitle). */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          justifyContent: 'center', marginTop: 24,
        }}>
          {SUGGESTIONS.map(s => {
            const label = t(lang, s.de, s.en);
            return (
            <button
              key={s.de}
              type="button"
              onClick={() => onSuggestionClick(label)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--surface-1)', border: '1px solid var(--rule)',
                borderRadius: 9999, padding: isMobile ? '6px 12px' : '8px 14px',
                fontSize: isMobile ? 'var(--t-caption-fs)' : 'var(--t-small-fs)', color: 'var(--ink-1)',
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)'; }}
            >
              <s.Icon size={isMobile ? 14 : 16} />
              <span>{label}</span>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
