'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { AvatarMenu } from '@/components/header/AvatarMenu';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

interface HeaderProps {
  projectName?: string;
  activeTab?: 'chat' | 'code' | 'preview';
  onTabChange?: (tab: 'chat' | 'code' | 'preview') => void;
  showTabs?: boolean;
  /** Whether the user is inside a project context. Code tab is inactive
      without a project (chat works everywhere; code needs a place to live). */
  hasProject?: boolean;
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
  hasProject = false,
  injectionCount = 0,
  onMenuToggle,
  previewUrl,
}: HeaderProps) {
  const router = useRouter();
  const { setShowNewProjectModal } = useApp();
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const activeTabDef = TAB_DEFS.find(t => t.id === activeTab) ?? TAB_DEFS[0]!;

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
    <header className="goblin-header" style={{
      background: 'var(--brand-header)',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8, flexShrink: 0,
      borderBottom: '1px solid rgba(247,247,236,0.10)',
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
          color: 'var(--ink-on-dark-1)',
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

      {/* Logo — real brand g-mark (GoblinLogo → _symbols.svg geometry, §B1).
          Desktop: mark + "Goblin" wordmark. Mobile: mark only (.goblin-wordmark
          hidden ≤768px). Wordmark is Manrope 700, -0.02em, gold per §B1.1. */}
      <button
        onClick={() => router.push('/dashboard')}
        aria-label="Goblin home"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 4px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
      >
        <GoblinLogo state="idle" size={26} variant="gold" />
        <span className="goblin-wordmark" style={{
          fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
          fontWeight: 700, fontSize: 'var(--t-h4-fs)', letterSpacing: '-0.02em',
          color: 'var(--brand-gold)', lineHeight: 1,
        }}>
          Goblin
        </span>
      </button>

      {/* Breadcrumb — project name only on desktop or where space allows */}
      {projectName && (
        <div className="goblin-breadcrumb" style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0,
        }}>
          <span style={{ color: 'var(--ink-on-dark-3)', fontSize: 'var(--t-small-fs)' }}>/</span>
          <div style={{
            fontSize: 'var(--t-small-fs)', color: 'var(--ink-on-dark-2)',
            background: 'rgba(255,255,255,0.08)',
            padding: '5px 10px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: 180,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-dash-display), Manrope, sans-serif', fontWeight: 500,
          }}>
            {projectName}
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Mobile mode tile — current mode + switcher (§TASK 5). Mobile only;
          desktop keeps the tab-pill switcher. Honours the staircase rule.
          Sits after the spacer so it right-aligns before the plus (v7/v2). */}
      {showTabs && (
        <div className="goblin-mode-tile" style={{ position: 'relative', flexShrink: 0, display: 'none' }}>
          <button
            onClick={() => setModeOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={modeOpen}
            aria-label={`Modus: ${activeTabDef.label}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, minHeight: 36,
              padding: '6px 10px', borderRadius: 9,
              background: 'rgba(0,0,0,0.18)', border: 'none', cursor: 'pointer',
              color: 'var(--ink-on-dark-1)', fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              fontWeight: 600, fontSize: 'var(--t-caption-fs)',
            }}
          >
            <activeTabDef.Icon size={15} />
            <span>{activeTabDef.label}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ opacity: 0.7 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {modeOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setModeOpen(false)} />
              <div role="menu" style={{
                position: 'absolute', left: 0, top: 'calc(100% + 8px)',
                background: 'var(--panel)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, padding: 4, minWidth: 200, zIndex: 100,
                boxShadow: 'var(--shadow-popover)',
              }}>
                {TAB_DEFS.map(({ id, label, Icon }) => {
                  const disabled = (id === 'code' && !hasProject) || (id === 'preview' && !previewUrl);
                  const active = activeTab === id;
                  const hint = id === 'code' && !hasProject ? 'Wird verfügbar, sobald Goblin ein Projekt startet'
                    : id === 'preview' && !previewUrl ? 'Wird verfügbar nach dem ersten Build' : undefined;
                  return (
                    <button
                      key={id}
                      role="menuitem"
                      disabled={disabled}
                      title={hint}
                      onClick={() => { if (!disabled) { onTabChange?.(id); setModeOpen(false); } }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', minHeight: 44, borderRadius: 7,
                        background: active ? 'rgba(45,74,43,0.08)' : 'none', border: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                        color: disabled ? 'var(--ink-disabled)' : active ? 'var(--brand-green)' : 'var(--text)',
                        fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                        fontWeight: active ? 600 : 500, fontSize: 'var(--t-small-fs)',
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      <Icon size={16} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-gold)' }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

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
            // Honest staircase: Chat always works; Code needs a project;
            // Preview needs a deployed app.
            const disabled =
              (id === 'code' && !hasProject) ||
              (id === 'preview' && !previewUrl);
            const hint =
              id === 'code' && !hasProject
                ? 'Starte ein Projekt, um Code zu schreiben'
                : id === 'preview' && !previewUrl
                ? 'Deploye das Projekt, um eine Preview zu sehen'
                : undefined;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-label={label}
                aria-disabled={disabled}
                title={hint}
                disabled={disabled}
                onClick={() => !disabled && onTabChange?.(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 7,
                  background: active ? 'var(--surface-1, #fff)' : 'transparent',
                  color: active ? 'var(--brand-header)' : 'var(--ink-on-dark-2)',
                  fontWeight: active ? 600 : 500,
                  fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                  transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
                  position: 'relative', minHeight: 26,
                }}
              >
                <Icon size={14} />
                <span className="goblin-tab-label">{label}</span>
                {id === 'code' && injectionCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--gold)',
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
            width: 30, height: 30, borderRadius: '50%',
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
                    gap: 2, fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                  <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)' }}>{item.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Local/Cloud routing toggle relocated into the account menu (AvatarMenu)
          per SCREEN_03_REBUILD §TASK 2 — header is logo · tabs · account.
          Behaviour unchanged; only its location moved. */}

      {/* Avatar — opens BottomSheet menu (mobile + desktop); now also hosts the
          Local/Cloud switch. */}
      <AvatarMenu />

      <style>{`
        .goblin-header { height: 56px; }
        @media (min-width: 769px) { .goblin-header { height: 60px; } }
        @media (max-width: 768px) {
          .goblin-hamburger { display: flex !important; }
          .goblin-breadcrumb { display: none !important; }
          .goblin-wordmark { display: none !important; }
          /* On mobile the desktop tab-pill switcher is replaced by the compact
             mode-tile (§TASK 5) — no bottom bar. */
          .goblin-tab-pills { display: none !important; }
          .goblin-mode-tile { display: block !important; }
        }
      `}</style>
    </header>
  );
}
