'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';

function ProviderIcon({ provider }: { provider?: string }) {
  if (provider === 'google') return (
    <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
  if (provider === 'github') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
  return null;
}

interface UserInfo {
  email: string;
  name: string | null;
  provider?: string;
  initial: string;
}

interface HeaderProps {
  projectName?: string;
  activeTab?: 'chat' | 'code' | 'preview';
  onTabChange?: (tab: 'chat' | 'code' | 'preview') => void;
  showTabs?: boolean;
  injectionCount?: number;
  onMenuToggle?: () => void;
  previewUrl?: string | null;
}

function ChatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function CodeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}
function PreviewIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

const TAB_DEFS = [
  { id: 'chat' as const, label: 'Chat', Icon: ChatIcon },
  { id: 'code' as const, label: 'Code', Icon: CodeIcon },
  { id: 'preview' as const, label: 'Preview', Icon: PreviewIcon },
];

export function Header({
  projectName,
  activeTab = 'chat',
  onTabChange,
  showTabs = false,
  injectionCount = 0,
  onMenuToggle,
  previewUrl,
}: HeaderProps) {
  const router = useRouter();
  const { setShowNewProjectModal } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const plusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const u = session.user;
      const name = u.user_metadata?.full_name ?? u.user_metadata?.name ?? null;
      const email = u.email ?? '';
      const initial = (name ?? email).charAt(0).toUpperCase();
      const provider = u.app_metadata?.provider as string | undefined;
      setUser({ email, name, provider, initial });
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleNewChat = async () => {
    setPlusOpen(false);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/chat-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const s = await res.json() as { id: string };
        router.push(`/dashboard/chat/${s.id}`);
      }
    } catch { /* ignore */ }
  };

  return (
    <header style={{
      height: 56, background: 'var(--moss)',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8, flexShrink: 0,
      borderBottom: '1px solid #3A5A37',
      position: 'relative', zIndex: 50,
    }}>
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="goblin-hamburger"
        aria-label="Open menu"
        data-testid="mobile-hamburger"
        style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.85)',
          cursor: 'pointer', padding: 0,
          borderRadius: 6, width: 40, height: 40,
          display: 'none', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Logo — wordmark */}
      <button
        onClick={() => router.push('/dashboard')}
        aria-label="Goblin home"
        style={{
          fontFamily: 'Fraunces, serif', fontSize: 20,
          color: 'var(--ochre)', fontWeight: 700, letterSpacing: '-0.5px',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 4px', userSelect: 'none', flexShrink: 0,
        }}
      >
        Goblin<span style={{ opacity: 0.6 }}>.</span>
      </button>

      {/* Breadcrumb — project name only on desktop or where space allows */}
      {projectName && (
        <div className="goblin-breadcrumb" style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>/</span>
          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.08)',
            padding: '5px 10px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: 180,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
          }}>
            {projectName}
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Tab-Switcher Pills — visible when in workspace */}
      {showTabs && (
        <div
          className="goblin-tab-pills"
          role="tablist"
          style={{
            display: 'flex', gap: 2, padding: 3,
            background: 'rgba(0,0,0,0.18)', borderRadius: 10,
            flexShrink: 0,
          }}
        >
          {TAB_DEFS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            const disabled = id === 'preview' && !previewUrl;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-label={label}
                disabled={disabled}
                onClick={() => !disabled && onTabChange?.(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 7,
                  background: active ? 'var(--surface-1, #fff)' : 'transparent',
                  color: active ? 'var(--moss)' : 'rgba(255,255,255,0.78)',
                  fontWeight: active ? 600 : 500,
                  fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                  transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
                  position: 'relative', minHeight: 30,
                }}
              >
                <Icon size={14} />
                <span className="goblin-tab-label">{label}</span>
                {id === 'code' && injectionCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--ochre)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Plus FAB */}
      <div ref={plusRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setPlusOpen(p => !p)}
          data-testid="header-plus"
          aria-label="Create new"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--ochre)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.12s, background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e8b863')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--ochre)')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        {plusOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setPlusOpen(false)} />
            <div
              role="menu"
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: '#fff', border: '1px solid var(--div)',
                borderRadius: 10, padding: 4, minWidth: 220, zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}
            >
              {[
                { label: 'Neuer Chat', sub: 'Start a fresh conversation', onClick: handleNewChat },
                { label: 'Neues Projekt', sub: 'Create a project workspace', onClick: () => { setPlusOpen(false); setShowNewProjectModal(true); } },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 7,
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', flexDirection: 'column',
                    gap: 2, fontFamily: 'DM Sans, sans-serif',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--meta)' }}>{item.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Avatar + Dropdown — desktop only; mobile uses sidebar user-pill */}
      <div className="goblin-header-avatar" style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(p => !p)}
          data-testid="avatar-button"
          aria-label="Open account menu"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--ochre-dark)', border: 'none',
            fontSize: 13, fontWeight: 700, color: '#2a1f0f',
            cursor: 'pointer', transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e8b05a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--ochre-dark)')}
        >
          {user?.initial ?? 'G'}
        </button>

        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)',
              background: '#1a2e18', border: '1px solid #2d5229',
              borderRadius: 10, padding: '4px 0', minWidth: 220, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {user && (
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid #2d5229', marginBottom: 4,
                }}>
                  {user.name && (
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, marginBottom: 3 }}>
                      {user.name}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ProviderIcon provider={user.provider} />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </span>
                  </div>
                </div>
              )}
              <button
                data-testid="menu-item-help"
                onClick={() => { setMenuOpen(false); router.push('/help'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 14px',
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.8)', fontSize: 13,
                  fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Hilfe & Support
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 14px',
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.8)', fontSize: 13,
                  fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .goblin-hamburger { display: flex !important; }
          .goblin-breadcrumb { display: none !important; }
          .goblin-tab-label { display: none !important; }
          .goblin-header-avatar { display: none !important; }
        }
      `}</style>
    </header>
  );
}
