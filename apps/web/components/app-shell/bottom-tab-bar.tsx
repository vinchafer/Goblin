'use client';
import { useApp } from '@/contexts/app-context';

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

export function BottomTabBar({ hasProject = false }: { hasProject?: boolean }) {
  const { activeTab, setActiveTab, injectionCount, previewUrl } = useApp();

  // Honest staircase mirrors layout/Header.tsx: Chat always works;
  // Code needs a project; Preview needs a deployed app.
  const tabs = [
    { id: 'chat' as const, label: 'Chat', Icon: ChatIcon, disabled: false, hint: '' },
    { id: 'code' as const, label: 'Code', Icon: CodeIcon, disabled: !hasProject, hint: 'Starte ein Projekt, um Code zu schreiben' },
    { id: 'preview' as const, label: 'Preview', Icon: PreviewIcon, disabled: !previewUrl, hint: 'Deploye das Projekt, um eine Preview zu sehen' },
  ];

  return (
    <nav style={{
      height: 56,
      background: 'var(--white)',
      borderTop: '1px solid var(--div)',
      display: 'flex',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
    }} className="goblin-bottom-bar">
      {tabs.map(({ id, label, Icon, disabled, hint }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            className="tap-press-tint"
            onClick={() => !disabled && setActiveTab(id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, fontSize: 'var(--t-caption-fs)', fontWeight: 600, fontFamily: 'var(--font-sans)',
              color: active ? 'var(--brand-green)' : 'var(--meta)',
              position: 'relative', minHeight: 56, padding: '6px 0',
              opacity: disabled ? 0.45 : 1,
              WebkitTapHighlightColor: 'transparent',
            }}
            disabled={disabled}
            aria-disabled={disabled}
            title={hint || undefined}
            aria-label={label}
          >
            <Icon />
            <span style={{ fontSize: 'var(--t-caption-fs)', lineHeight: 1 }}>{label}</span>
            {/* Active indicator */}
            {active && (
              <span style={{
                position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                width: 20, height: 2, borderRadius: 1,
                background: 'var(--brand-green)',
              }} />
            )}
            {/* Injection dot on Code tab */}
            {id === 'code' && injectionCount > 0 && (
              <span style={{
                position: 'absolute', top: 8, right: '28%',
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--brand-gold)', animation: 'blink 1.5s infinite',
              }} />
            )}
          </button>
        );
      })}
      <style>{`
        .goblin-bottom-bar { display: none; }
        @media (max-width: 768px) { .goblin-bottom-bar { display: flex !important; } }
      `}</style>
    </nav>
  );
}
