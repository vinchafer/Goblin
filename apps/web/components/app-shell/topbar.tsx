'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { LocalCloudSwitch } from './local-cloud-switch';

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
      height: 48,
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
          color: 'rgba(255,255,255,0.65)',
          cursor: 'pointer', padding: '0 6px',
          borderRadius: 6, minWidth: 36, minHeight: 36,
          display: 'none', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <line x1="3" y1="5" x2="17" y2="5"/>
          <line x1="3" y1="10" x2="17" y2="10"/>
          <line x1="3" y1="15" x2="17" y2="15"/>
        </svg>
      </button>

      {/* LEFT: Logo + Project Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            fontFamily: 'Fraunces, serif', fontSize: 18,
            color: '#D4A94A', fontWeight: 700,
            letterSpacing: '-0.5px',
            userSelect: 'none', background: 'none', border: 'none',
            cursor: 'pointer', padding: '6px 4px',
          }}
        >
          Goblin<span style={{ opacity: 0.6 }}>.</span>
        </button>

        {projectName && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 14, flexShrink: 0 }}>/</span>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                fontSize: 13, color: 'rgba(255,255,255,0.7)',
                background: 'none', border: 'none',
                padding: '4px 6px', borderRadius: 5, cursor: 'pointer',
                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget.style.color = '#fff'); }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
              title="Back to projects"
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
          display: 'flex', gap: 0,
        }}
      >
        {(['chat', 'code', 'preview'] as const).map(tab => {
          const isActive = activeTab === tab;
          const isDisabled = tab === 'preview' && !previewUrl;
          return (
            <button
              key={tab}
              onClick={() => onTabChange?.(tab)}
              style={{
                padding: '0 18px', height: 48,
                fontSize: 13, fontWeight: isActive ? 500 : 400,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', fontFamily: 'DM Sans, sans-serif',
                transition: 'color 0.15s',
                position: 'relative',
                opacity: isDisabled ? 0.35 : 1,
              }}
              onMouseEnter={e => { if (!isActive && !isDisabled) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
              disabled={isDisabled}
              title={isDisabled ? 'Deploy first to see preview' : undefined}
            >
              {tab === 'chat' ? 'Chat' : tab === 'code' ? 'Code' : 'Preview'}
              {isActive && (
                <span style={{
                  position: 'absolute', bottom: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: '60%', height: 2,
                  background: '#D4A94A', borderRadius: '1px 1px 0 0',
                  display: 'block',
                }} />
              )}
              {tab === 'code' && injectionCount > 0 && !isActive && (
                <span style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#D4A94A',
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* RIGHT: Local/Cloud Switch + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <LocalCloudSwitch />

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
              minWidth: 220, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {userInfo && (
                <div style={{
                  padding: '10px 14px',
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

              <MenuItem onClick={() => { router.push('/dashboard/settings/keys'); setMenuOpen(false); }}>
                API Keys
              </MenuItem>
              <MenuItem onClick={() => { router.push('/dashboard/settings'); setMenuOpen(false); }}>
                Settings
              </MenuItem>
              <MenuItem onClick={() => { router.push('/dashboard/settings/billing'); setMenuOpen(false); }}>
                Billing
              </MenuItem>
              <div style={{ height: 1, background: '#2d5229', margin: '4px 8px' }} />
              <MenuItem onClick={handleSignOut}>
                Sign out
              </MenuItem>
            </div>
          </>
        )}
        </div>
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
