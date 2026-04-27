'use client';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  projectName?: string;
  activeTab?: 'chat' | 'code' | 'preview';
  onTabChange?: (tab: 'chat' | 'code' | 'preview') => void;
  selectedModel?: string;
  injectionCount?: number;
  onMenuToggle?: () => void;
  // legacy compat
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
      background: 'var(--moss)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      flexShrink: 0,
      borderBottom: '2px solid var(--moss2)',
      position: 'relative',
      zIndex: 50,
    }}>
      {/* Mobile hamburger */}
      <button
        onClick={handleMenu}
        className="mobile-menu-btn"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'none' }}
      >☰</button>

      {/* Logo */}
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: 'var(--ochre)', fontWeight: 700, letterSpacing: '-0.5px', marginRight: 4, flexShrink: 0 }}>
        Goblin<span style={{ opacity: 0.7 }}>.</span>
      </div>

      {/* Project name chip */}
      {projectName && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {projectName}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 8 }} className="desktop-tabs">
        {(['chat', 'code', 'preview'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange?.(tab)}
            style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', background: activeTab === tab ? 'rgba(255,255,255,0.13)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.45)',
              border: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'code' && injectionCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', animation: 'blink 1.5s infinite' }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Model pill */}
      <div
        onClick={() => router.push('/dashboard/settings/keys')}
        style={{
          background: 'rgba(201,147,58,0.15)', border: '1px solid rgba(201,147,58,0.4)',
          color: 'var(--ochre2)', fontSize: 11, padding: '4px 10px', borderRadius: 20,
          fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', flexShrink: 0,
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {selectedModel} · BYOK ▾
      </div>

      {/* Avatar */}
      <button
        onClick={() => router.push('/dashboard/settings')}
        style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--ochre)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--bark)', cursor: 'pointer', flexShrink: 0 }}
      >V</button>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .desktop-tabs { display: none !important; }
        }
      `}</style>
    </header>
  );
}
