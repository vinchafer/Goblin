'use client';

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

const SIZE = { sm: 28, md: 44, lg: 72 };
const FONT = { sm: 12, md: 14, lg: 18 };

function PulseDots({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--ochre)',
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
        background: 'var(--ochre)',
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
        <div className="goblin-wobble-loop" style={{ fontSize: iconSize, lineHeight: 1, userSelect: 'none' }}>
          👺
        </div>
        <span style={{
          fontFamily: 'Fraunces, serif', fontSize: 20,
          color: 'var(--ochre)', fontWeight: 700, letterSpacing: '-0.3px',
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
        <div className="goblin-think" style={{ fontSize: iconSize, lineHeight: 1, userSelect: 'none' }}>
          👺
        </div>
        <span style={{ fontSize: fontSize, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
          {label}
        </span>
        <OchreBar />
      </div>
    );
  }

  if (variant === 'deploy') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: iconSize * 0.6, animation: 'goblin-think 2s ease-in-out infinite', display: 'inline-block' }}>
          ☁️
        </span>
        <span style={{ fontSize: fontSize, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
          {label}
        </span>
        <PulseDots count={3} />
      </div>
    );
  }

  // thinking / files (default inline layout)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div className="goblin-think" style={{ fontSize: iconSize * 0.55, lineHeight: 1, userSelect: 'none' }}>
        👺
      </div>
      <span style={{
        fontSize: fontSize, color: 'var(--meta)',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {label}
      </span>
      <PulseDots />
    </div>
  );
}
