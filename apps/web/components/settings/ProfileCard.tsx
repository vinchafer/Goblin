'use client';

interface ProfileCardProps {
  avatarUrl?: string;
  name: string;
  email: string;
  plan: 'Build' | 'Pro' | 'Power';
  onClick: () => void;
  testId?: string;
}

const planColors: Record<string, { bg: string; color: string }> = {
  Build: { bg: 'var(--subtle)', color: 'var(--meta)' },
  Pro: { bg: 'color-mix(in srgb, var(--brand-green) 8%, transparent)', color: 'var(--brand-green)' },
  Power: { bg: 'color-mix(in srgb, var(--brand-gold) 12%, transparent)', color: 'var(--ink-2)' },
};

export function ProfileCard({ avatarUrl, name, email, plan, onClick, testId }: ProfileCardProps) {
  const initial = (name?.[0] ?? email?.[0] ?? 'V').toUpperCase();
  const planColor = planColors[plan] ?? planColors.Build ?? { bg: 'var(--subtle)', color: 'var(--meta)' };

  return (
    <button
      onClick={onClick}
      data-testid={testId ?? 'profile-card'}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        background: 'var(--panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        marginTop: 8,
        marginBottom: 24,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--brand-green)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 600,
          flexShrink: 0,
        }}>{initial}</span>
      )}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontSize: 'var(--t-body-fs)',
          fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{name || 'Vincent'}</span>
        <span style={{
          fontSize: 13,
          color: 'var(--text-meta)',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{email}</span>
      </span>
      <span style={{
        padding: '4px 10px',
        borderRadius: 12,
        background: planColor.bg,
        color: planColor.color,
        fontSize: 'var(--t-caption-fs)',
        fontWeight: 600,
        flexShrink: 0,
      }}>{plan}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-meta)', flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
