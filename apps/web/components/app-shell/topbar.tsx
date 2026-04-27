'use client';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  projectName?: string;
  activeTab?: 'chat' | 'code' | 'preview';
  onTabChange?: (tab: 'chat' | 'code' | 'preview') => void;
  selectedModel?: string;
  injectionCount?: number;
  onMenuToggle?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function Topbar({
  projectName,
  activeTab = 'chat',
  onTabChange,
  selectedModel = 'claude-sonnet-4-6',
  injectionCount = 0,
  onMenuToggle,
  onToggleSidebar,
}: TopbarProps) {
  const router = useRouter();
  const handleMenu = onMenuToggle ?? onToggleSidebar;

  return (
    <header style={{
      height: 52,
      background: '#1e3a1c',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      flexShrink: 0,
      borderBottom: '2px solid #2d5229',
      position: 'relative',
      zIndex: 50,
    }}>
      {/* Hamburger — mobile only */}
      <button
        onClick={handleMenu}
        className="topbar-hamburger"
        aria-label="Open menu"
        style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.65)', fontSize: 18,
          cursor: 'pointer', padding: '0 6px',
          borderRadius: 6, minWidth: 44, minHeight: 44,
          display: 'none', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >☰</button>

      {/* Logo */}
      <div style={{
        fontFamily: 'Fraunces, serif', fontSize: 20,
        color: '#c9933a', fontWeight: 700,
        letterSpacing: '-0.5px', marginRight: 4, flexShrink: 0,
        userSelect: 'none',
      }}>
        Goblin<span style={{ opacity: 0.65 }}>.</span>
      </div>

      {/* Project chip */}
      {projectName && (
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.55)',
          background: 'rgba(255,255,255,0.07)',
          padding: '3px 10px', borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0, maxWidth: 160,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {projectName}
        </div>
      )}

      {/* Tab switcher — desktop only */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 8 }} className="topbar-tabs">
        {(['chat', 'code', 'preview'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange?.(tab)}
            style={{
              padding: '5px 14px', borderRadius: 6,
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === tab ? 'rgba(255,255,255,0.13)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none', fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s', position: 'relative',
              minHeight: 32,
            }}
            onMouseEnter={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'code' && injectionCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 6, height: 6, borderRadius: '50%',
                background: '#c9933a', animation: 'blink 1.5s infinite',
              }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Model pill */}
      <div
        onClick={() => router.push('/dashboard/settings/keys')}
        title="Change model / API keys"
        style={{
          background: 'rgba(201,147,58,0.14)',
          border: '1px solid rgba(201,147,58,0.38)',
          color: '#e8b05a', fontSize: 11,
          padding: '4px 10px', borderRadius: 20,
          fontFamily: 'JetBrains Mono, monospace',
          cursor: 'pointer', flexShrink: 0,
          maxWidth: 180, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,147,58,0.6)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,147,58,0.38)'}
      >
        {selectedModel} · BYOK ▾
      </div>

      {/* Avatar */}
      <button
        onClick={() => router.push('/dashboard/settings')}
        aria-label="Settings"
        style={{
          width: 30, height: 30, borderRadius: '50%',
          background: '#c9933a', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#2a1f0f',
          cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e8b05a'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#c9933a'}
      >V</button>

      <style>{`
        @media (max-width: 768px) {
          .topbar-hamburger { display: flex !important; }
          .topbar-tabs { display: none !important; }
        }
      `}</style>
    </header>
  );
}
