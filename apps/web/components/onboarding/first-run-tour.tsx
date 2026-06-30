'use client';
import { useState } from 'react';
import { useOnbLang } from '@/app/welcome/_components/i18n';

// Honest, fully-localised first-run tour (Sprint 11 onboarding follow-up).
// Previously the steps were hard-coded with MIXED languages (steps 1+3 and the
// buttons English, step 2 German) → a DE user saw an English tour and an EN
// user saw a German step. Every string now lives in both languages and is
// keyed off the same goblin:preferred-lang the rest of the app uses.

const STEPS = {
  de: [
    {
      title: 'Hier leben deine Projekte',
      body: 'Erstelle neue Projekte über die Seitenleiste. Jedes Projekt hat eigenen Chat, Code und eine Vorschau.',
      icon: '📁',
    },
    {
      title: 'Vom Chat in den Code',
      body: 'Bitte Goblin, etwas zu bauen. Gibt es Code aus, bringt [An Code senden] ihn als Entwurf in den Code-Tab — du sicherst und veröffentlichst, wenn du bereit bist.',
      icon: '✦',
    },
    {
      title: 'Behalte deinen Verbrauch im Blick',
      body: 'Sieh, wie viele Anfragen du diesen Monat genutzt hast. Upgrade oder eigener BYOK-Key jederzeit.',
      icon: '📊',
    },
  ],
  en: [
    {
      title: 'Your projects live here',
      body: 'Create new projects from the sidebar. Each project has its own chat, code, and preview.',
      icon: '📁',
    },
    {
      title: 'From chat to code',
      body: 'Ask Goblin to build something. When it outputs code, [Send to Code] brings it into the Code tab as a draft — you save and publish when you are ready.',
      icon: '✦',
    },
    {
      title: 'Track your usage here',
      body: "See how many requests you've used this month. Upgrade or add a BYOK key anytime.",
      icon: '📊',
    },
  ],
} as const;

const TOUR_COPY = {
  de: { close: 'Tour schließen', skip: 'Tour überspringen', next: 'Weiter →', last: 'Los geht’s →' },
  en: { close: 'Close tour', skip: 'Skip tour', next: 'Next →', last: "Let's build →" },
} as const;

interface FirstRunTourProps {
  onDone: () => void;
}

export function FirstRunTour({ onDone }: FirstRunTourProps) {
  const lang = useOnbLang();
  const steps = STEPS[lang];
  const tc = TOUR_COPY[lang];
  const [step, setStep] = useState(0);

  const current = steps[step]!;
  const isLast = step === steps.length - 1;

  return (
    <>
      {/* Backdrop — semi-transparent, skippable */}
      <div
        onClick={onDone}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Tour card */}
      <div
        style={{
          position: 'fixed',
          bottom: 80, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          background: '#fff',
          borderRadius: 16,
          padding: '20px 24px',
          width: 'min(360px, calc(100vw - 32px))',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Close button — top right */}
        <button
          onClick={onDone}
          aria-label={tc.close}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--div)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 'var(--t-body-fs)', color: 'var(--meta)',
            lineHeight: 1, transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--div)')}
        >
          ×
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i <= step ? 'var(--brand-green)' : 'var(--div)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 28, marginBottom: 10 }}>{current.icon}</div>
        <h3 style={{ fontSize: 'var(--t-body-fs)', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6, margin: '0 0 20px' }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onDone}
            style={{
              background: 'none', border: 'none',
              color: 'var(--disabled)', fontSize: 'var(--t-caption-fs)', cursor: 'pointer',
              textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.15)',
            }}
          >
            {tc.skip}
          </button>

          <button
            onClick={() => isLast ? onDone() : setStep(s => s + 1)}
            style={{
              padding: '9px 20px',
              background: 'var(--brand-green)', color: 'var(--brand-gold)',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isLast ? tc.last : tc.next}
          </button>
        </div>
      </div>
    </>
  );
}
