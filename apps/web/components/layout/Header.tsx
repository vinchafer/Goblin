'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { AvatarMenu } from '@/components/header/AvatarMenu';

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
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement | null>(null);

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
            background: 'transparent', color: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.35)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
                background: 'var(--panel)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, padding: 4, minWidth: 220, zIndex: 100,
                boxShadow: 'var(--shadow-popover)',
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

      {/* Avatar — opens BottomSheet menu (mobile + desktop) */}
      <AvatarMenu />

      <style>{`
        @media (max-width: 768px) {
          .goblin-hamburger { display: flex !important; }
          .goblin-breadcrumb { display: none !important; }
          .goblin-tab-label { display: none !important; }
        }
      `}</style>
    </header>
  );
}
