'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { ModelSwitcher } from './model-switcher';

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 14px',
        background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.8)', fontSize: 13,
        fontFamily: 'DM Sans, sans-serif',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
    >
      {children}
    </button>
  );
}

interface TopbarProps {
  projectName?: string;
  activeTab?: 'chat' | 'code' | 'preview';
  onTabChange?: (tab: 'chat' | 'code' | 'preview') => void;
  selectedModel?: string;
  // Deprecated — model management moved to ModelSwitcher component
  // Kept for backward compatibility with DashboardShell
  // @deprecated
  injectionCount?: number;
  onMenuToggle?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  previewUrl?: string | null;
}

export function Topbar({
  projectName,
  activeTab = 'chat',
  onTabChange,
  injectionCount = 0,
  onMenuToggle,
  onToggleSidebar,
  previewUrl,
}: TopbarProps) {
  const router = useRouter();
  const handleMenu = onMenuToggle ?? onToggleSidebar;
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      setUserEmail(session.user.email);
    }
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header style={{
      height: 56,
      background: '#2D4A2B',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      flexShrink: 0,
      borderBottom: '1px solid #3A5A37',
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

      {/* Logo - clickable */}
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          fontFamily: 'Fraunces, serif', fontSize: 20,
          color: '#D4A94A', fontWeight: 700,
          letterSpacing: '-0.5px', marginRight: 4, flexShrink: 0,
          userSelect: 'none', background: 'none', border: 'none',
          cursor: 'pointer', padding: '8px 4px',
        }}
      >
        Goblin<span style={{ opacity: 0.65 }}>.</span>
      </button>

      {/* Project name - editable on double click */}
      {projectName && (
        <div
          style={{
            fontSize: 14, color: 'rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.05)',
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0, maxWidth: 200,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
            cursor: 'pointer',
          }}
          onDoubleClick={() => {
            // TODO: Implement project name editing
            console.log('Edit project name:', projectName);
          }}
          title="Double-click to edit"
        >
          {projectName}
        </div>
      )}

      {/* Tab switcher — desktop only */}
      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} className="topbar-tabs">
        {(['chat', 'code', 'preview'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange?.(tab)}
            style={{
              padding: '6px 16px', borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === tab ? '#ffffff' : 'transparent',
              color: activeTab === tab ? '#2D4A2B' : 'rgba(255,255,255,0.6)',
              border: 'none', fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s', position: 'relative',
              minHeight: 32,
            }}
            onMouseEnter={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; }}
            onMouseLeave={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
            disabled={tab === 'preview' && !previewUrl}
            title={tab === 'preview' && !previewUrl ? 'Deploy first to see preview' : ''}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'code' && injectionCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 6, height: 6, borderRadius: '50%',
                background: '#D4A94A', animation: 'blink 1.5s infinite',
              }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Model Switcher */}
      <ModelSwitcher />

      {/* Avatar + Dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          aria-label="User menu"
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#c9933a', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#2a1f0f',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e8b05a'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#c9933a'}
        >
          {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
        </button>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)',
              background: '#1a2e18', border: '1px solid #2d5229',
              borderRadius: 8, padding: '4px 0',
              minWidth: 200, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {userEmail && (
                <>
                  <div style={{
                    padding: '8px 14px',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    fontFamily: 'DM Sans, sans-serif',
                    borderBottom: '1px solid #2d5229',
                    marginBottom: 4,
                  }}>
                    {userEmail}
                  </div>
                  <div style={{ height: 1, background: '#2d5229', margin: '4px 8px' }} />
                </>
              )}
              <MenuItem onClick={() => { router.push('/settings?tab=api-keys'); setMenuOpen(false); }}>
                🔑 API Keys
              </MenuItem>
              <MenuItem onClick={() => { router.push('/settings?tab=account'); setMenuOpen(false); }}>
                ⚙️ Account
              </MenuItem>
              <div style={{ height: 1, background: '#2d5229', margin: '4px 8px' }} />
              <MenuItem onClick={handleSignOut}>
                🚪 Sign out
              </MenuItem>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .topbar-hamburger { display: flex !important; }
          .topbar-tabs { display: none !important; }
        }
      `}</style>
    </header>
  );
}
