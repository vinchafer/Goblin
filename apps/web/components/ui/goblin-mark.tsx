'use client';

interface GoblinMarkProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function GoblinMark({ size = 32, className, style }: GoblinMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      {/* Head shape — slightly pointed at top like a goblin */}
      <path
        d="M16 3 C10 3 6 7.5 6 13.5 C6 18 8 21 10.5 23 L10 28 L12.5 26.5 L16 28.5 L19.5 26.5 L22 28 L21.5 23 C24 21 26 18 26 13.5 C26 7.5 22 3 16 3Z"
        fill="var(--moss)"
      />
      {/* Eyes — white, slightly mischievous */}
      <ellipse cx="12.5" cy="13.5" rx="2" ry="2.5" fill="white" />
      <ellipse cx="19.5" cy="13.5" rx="2" ry="2.5" fill="white" />
      {/* Pupils */}
      <circle cx="13" cy="13.5" r="1" fill="var(--bark-dark, #2a1f0f)" />
      <circle cx="20" cy="13.5" r="1" fill="var(--bark-dark, #2a1f0f)" />
      {/* Small pointy ears */}
      <path d="M6.5 10 L4 7 L7 9" fill="var(--moss)" />
      <path d="M25.5 10 L28 7 L25 9" fill="var(--moss)" />
      {/* Ochre accent — small nose */}
      <circle cx="16" cy="17" r="1.5" fill="var(--ochre)" opacity="0.8" />
    </svg>
  );
}

interface GoblinWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  showMark?: boolean;
}

export function GoblinWordmark({ size = 'md', className, style, showMark = true }: GoblinWordmarkProps) {
  const fontSize = size === 'sm' ? 16 : size === 'md' ? 22 : 32;
  const markSize = size === 'sm' ? 20 : size === 'md' ? 28 : 40;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? 6 : 8,
        ...style,
      }}
    >
      {showMark && <GoblinMark size={markSize} />}
      <span
        style={{
          fontFamily: 'Fraunces, serif',
          fontSize,
          fontWeight: 700,
          color: 'var(--moss)',
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}
      >
        Goblin
      </span>
    </div>
  );
}
