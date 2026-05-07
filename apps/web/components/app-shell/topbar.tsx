'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';

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

function ProviderIcon({ provider }: { provider: string | undefined }) {
  if (provider === 'google') return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
  if (provider === 'github') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" style={{ flexShrink: 0 }}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
  if (provider === 'apple') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" style={{ flexShrink: 0 }}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
  return null;
}

interface UserInfo {
  email: string;
  name: string | null;
  provider: string | undefined;
  avatarInitial: string;
}

interface TopbarProps {
  projectName?: string;
  activeTab?: 'chat' | 'code' | 'preview';
  onTabChange?: (tab: 'chat' | 'code' | 'preview') => void;
  selectedModel?: string;
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
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const user = session.user;
    const provider = user.app_metadata?.provider as string | undefined;
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
    const email = user.email ?? '';
    const initial = (name ?? email).charAt(0).toUpperCase();
    setUserInfo({ email, name, provider, avatarInitial: initial });
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

      {/* LEFT: Logo + Project Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            fontFamily: 'Fraunces, serif', fontSize: 20,
            color: '#D4A94A', fontWeight: 700,
            letterSpacing: '-0.5px',
            userSelect: 'none', background: 'none', border: 'none',
            cursor: 'pointer', padding: '8px 4px',
          }}
        >
          Goblin<span style={{ opacity: 0.65 }}>.</span>
        </button>

        {projectName && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, flexShrink: 0 }}>/</span>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                fontSize: 13, color: 'rgba(255,255,255,0.75)',
                background: 'none', border: 'none',
                padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.08)'); (e.currentTarget.style.color = '#fff'); }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = 'rgba(255,255,255,0.75)'); }}
              title="Projekt wechseln"
            >
              {projectName}
            </button>
          </>
        )}
      </div>

      {/* CENTER: Tab switcher — desktop only */}
      <div
        className="topbar-tabs"
        style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 4,
        }}
      >
        {(['chat', 'code', 'preview'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange?.(tab)}
            style={{
              padding: '6px 18px', borderRadius: 8,
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
            title={tab === 'preview' && !previewUrl ? 'Erst deployen für Preview' : undefined}
          >
            {tab === 'chat' ? 'Chat' : tab === 'code' ? 'Code' : 'Preview'}
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

      {/* RIGHT: Avatar + Dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          aria-label="User menu"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#c9933a', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#2a1f0f',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e8b05a'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#c9933a'}
        >
          {userInfo?.avatarInitial ?? 'U'}
        </button>

        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)',
              background: '#1a2e18', border: '1px solid #2d5229',
              borderRadius: 10, padding: '4px 0',
              minWidth: 240, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {/* User info */}
              {userInfo && (
                <div style={{
                  padding: '10px 14px 10px',
                  borderBottom: '1px solid #2d5229',
                  marginBottom: 4,
                }}>
                  {userInfo.name && (
                    <div style={{
                      color: 'rgba(255,255,255,0.9)', fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                      marginBottom: 2,
                    }}>
                      {userInfo.name}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ProviderIcon provider={userInfo.provider} />
                    <span style={{
                      color: 'rgba(255,255,255,0.45)', fontSize: 11,
                      fontFamily: 'DM Sans, sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {userInfo.email}
                    </span>
                  </div>
                </div>
              )}

              {/* Plan & Usage */}
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid #2d5229',
                marginBottom: 4,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif' }}>
                    Plan
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#D4A94A',
                    fontFamily: 'DM Sans, sans-serif', background: 'rgba(212,169,74,0.15)',
                    padding: '2px 8px', borderRadius: 4,
                  }}>
                    Free
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>
                  Tokens diesen Monat
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: '#D4A94A', width: '0%' }} />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>
                  0 / 100k verwendet
                </div>
              </div>

              <MenuItem onClick={() => { router.push('/dashboard/settings/keys'); setMenuOpen(false); }}>
                API Keys
              </MenuItem>
              <MenuItem onClick={() => { router.push('/dashboard/settings'); setMenuOpen(false); }}>
                Einstellungen
              </MenuItem>
              <MenuItem onClick={() => { router.push('/dashboard/settings/billing'); setMenuOpen(false); }}>
                Billing & Plan
              </MenuItem>
              <div style={{ height: 1, background: '#2d5229', margin: '4px 8px' }} />
              <MenuItem onClick={handleSignOut}>
                Abmelden
              </MenuItem>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 768px) {
          .topbar-hamburger { display: flex !important; }
          .topbar-tabs { display: none !important; }
        }
      `}</style>
    </header>
  );
}
