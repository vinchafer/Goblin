'use client';
import { useState } from 'react';

const STEPS = [
  {
    title: 'Your projects live here',
    body: 'Create new projects from the sidebar. Each project has its own chat, code, and preview.',
    icon: '📁',
    position: 'sidebar',
  },
  {
    title: 'Chat → Code in one tap',
    body: 'Ask Goblin to build anything. When it outputs code, hit [Send to Code] to apply it instantly.',
    icon: '✦',
    position: 'chat',
  },
  {
    title: 'Track your usage here',
    body: 'See how many requests you\'ve used this month. Upgrade or add a BYOK key anytime.',
    icon: '📊',
    position: 'topbar',
  },
];

interface FirstRunTourProps {
  onDone: () => void;
}

export function FirstRunTour({ onDone }: FirstRunTourProps) {
  const [step, setStep] = useState(0);

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

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
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i <= step ? '#2D4A2B' : '#E8E4DC',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 28, marginBottom: 10 }}>{current.icon}</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#2A2A2A', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.6, margin: '0 0 20px' }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onDone}
            style={{
              background: 'none', border: 'none',
              color: '#9B9B9B', fontSize: 12, cursor: 'pointer',
              textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.15)',
            }}
          >
            Skip tour
          </button>

          <button
            onClick={() => isLast ? onDone() : setStep(s => s + 1)}
            style={{
              padding: '9px 20px',
              background: '#2D4A2B', color: '#D4A94A',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isLast ? "Let's build →" : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
