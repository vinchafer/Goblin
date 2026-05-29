'use client';
import { GoblinMark } from './goblin-mark';

export type GoblinLoaderVariant =
  | 'thinking'
  | 'page'
  | 'files'
  | 'build'
  | 'deploy';

interface GoblinLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: GoblinLoaderVariant;
}

const SIZE = { sm: 20, md: 32, lg: 56 };
const FONT = { sm: 12, md: 14, lg: 18 };

function PulseDots({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--brand-gold)',
            animation: 'goblin-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

function OchreBar({ pct = 65 }: { pct?: number }) {
  return (
    <div style={{
      width: 160, height: 3, borderRadius: 2,
      background: 'rgba(212,169,74,0.2)', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: 2,
        background: 'var(--brand-gold)',
        width: `${pct}%`,
        animation: 'pw 2s ease-in-out infinite alternate',
      }} />
    </div>
  );
}

export function GoblinLoader({
  message,
  size = 'md',
  variant = 'thinking',
}: GoblinLoaderProps) {
  const iconSize = SIZE[size];
  const fontSize = FONT[size];

  const defaultMessages: Record<GoblinLoaderVariant, string> = {
    thinking: 'Your goblin is thinking…',
    page: 'Loading…',
    files: 'Your goblin is reading the files…',
    build: 'Your goblin is building…',
    deploy: 'Pushing to the cloud…',
  };

  const label = message ?? defaultMessages[variant];

  if (variant === 'page') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 40,
      }}>
        <GoblinMark
          size={iconSize}
          className="goblin-wobble-loop"
        />
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 20,
          color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.3px',
        }}>
          Goblin
        </span>
      </div>
    );
  }

  if (variant === 'build') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 10, padding: 24,
      }}>
        <GoblinMark size={iconSize} className="goblin-think" />
        <span style={{ fontSize: fontSize, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
          {label}
        </span>
        <OchreBar />
      </div>
    );
  }

  if (variant === 'deploy') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: iconSize * 0.6, animation: 'goblin-think 2s ease-in-out infinite', display: 'inline-block' }}>
          ☁️
        </span>
        <span style={{ fontSize: fontSize, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
          {label}
        </span>
        <PulseDots count={3} />
      </div>
    );
  }

  // thinking / files (default inline layout)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <GoblinMark size={Math.round(iconSize * 0.75)} className="goblin-think" />
      <span style={{
        fontSize: fontSize, color: 'var(--meta)',
        fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </span>
      <PulseDots />
    </div>
  );
}
