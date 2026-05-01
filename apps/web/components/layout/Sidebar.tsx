'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/app-context';

interface Project {
  id: string;
  name: string;
  color?: string;
  updated_at?: string;
  last_active?: string;
  description?: string | null;
}

interface SidebarProps {
  projects?: Project[];
  activeProjectId?: string;
  userEmail?: string;
  userName?: string;
  isOpen?: boolean;          // mobile overlay open
  onClose?: () => void;      // mobile close
}

const PROJECT_COLORS = [
  '#D4A94A', '#4A7C3B', '#7A4A8A',
  '#3A6B8A', '#B85C3C', '#4A7A7A', '#2D4A2B',
];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'now';
  if (h < 1) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function ChevronLeft({ small }: { small?: boolean }) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  );
}

function ChevronRight({ small }: { small?: boolean }) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}

const STORAGE_KEY = 'goblin:sidebar:collapsed';

export function Sidebar({ projects = [], activeProjectId, userEmail, userName, isOpen = false, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setShowNewProjectModal } = useApp();

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default: open on desktop, collapsed on mobile
      const isMobile = window.innerWidth < 768;
      setCollapsed(stored !== null ? stored === 'true' : isMobile);
    }
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const displayName = userName || userEmail?.split('@')[0] || 'Builder';
  const initial = displayName.charAt(0).toUpperCase();

  const navigate = (path: string) => {
    router.push(path);
    onClose?.();
  };

  const sidebarWidth = collapsed ? 56 : 260;

  if (!mounted) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 39,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: '#F2EDE4',
          borderRight: '1px solid #DDD7CC',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 40,
          flexShrink: 0,
        }}
        className="goblin-sidebar-desktop"
      >
        {/* ── Logo & User ── */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 12px' : '0 16px',
          borderBottom: '1px solid #DDD7CC', flexShrink: 0,
          gap: 10, justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          {!collapsed ? (
            <>
              <div
                onClick={() => navigate('/dashboard')}
                style={{
                  fontFamily: 'Fraunces, serif', fontSize: 17,
                  color: '#2D4A2B', fontWeight: 700, letterSpacing: '-0.3px',
                  cursor: 'pointer', userSelect: 'none', flexShrink: 0,
                }}
              >
                Goblin<span style={{ opacity: 0.45 }}>.</span>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{
                fontSize: 11, color: '#8C857A',
                fontFamily: 'DM Sans, sans-serif',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 100,
              }}>
                {displayName}
              </div>
              {/* Collapse toggle */}
              <button
                onClick={toggle}
                title="Collapse sidebar"
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid #DDD7CC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#8C857A', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronLeft small />
              </button>
            </>
          ) : (
            <button
              onClick={toggle}
              title="Expand sidebar"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(45,74,43,0.08)',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#2D4A2B', flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.08)')}
            >
              <ChevronRight small />
            </button>
          )}
        </div>

        {/* ── New Project ── */}
        <div style={{ padding: collapsed ? '10px 8px' : '10px 12px', flexShrink: 0 }}>
          <button
            onClick={() => { setShowNewProjectModal(true); onClose?.(); }}
            title="New Project"
            style={{
              width: '100%', background: '#2D4A2B', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: collapsed ? '8px 0' : '9px 12px',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 7,
              justifyContent: 'center',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
              minHeight: 36,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#3A5A37')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
          >
            <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>＋</span>
            {!collapsed && 'New Project'}
          </button>
        </div>

        {/* ── Projects List ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {!collapsed && (
            <div style={{
              padding: '4px 16px 6px',
              fontSize: 10, fontWeight: 600,
              letterSpacing: '1.2px', textTransform: 'uppercase',
              color: '#9C9589',
            }}>
              Projects
            </div>
          )}

          {projects.length === 0 ? (
            !collapsed && (
              <div style={{
                padding: '8px 16px', fontSize: 12,
                color: '#9C9589', fontStyle: 'italic',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                No projects yet
              </div>
            )
          ) : (
            <div style={{ padding: collapsed ? '0 8px' : '0 8px 8px' }}>
              {projects.map((p, i) => {
                const active = activeProjectId === p.id;
                const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/dashboard/project/${p.id}`)}
                    title={collapsed ? p.name : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 8,
                      padding: collapsed ? '8px 0' : '7px 8px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: 7, cursor: 'pointer', marginBottom: 1,
                      background: active ? 'rgba(212,169,74,0.13)' : 'transparent',
                      border: active ? '1px solid rgba(212,169,74,0.25)' : '1px solid transparent',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: dotColor, flexShrink: 0,
                    }} />
                    {!collapsed && (
                      <>
                        <span style={{
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          color: active ? '#2D4A2B' : '#2A2A2A',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'DM Sans, sans-serif',
                        }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#9C9589', flexShrink: 0 }}>
                          {timeAgo(p.updated_at ?? p.last_active)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Settings ── */}
        <div style={{
          padding: collapsed ? '8px' : '8px 12px',
          borderTop: '1px solid #DDD7CC', flexShrink: 0,
        }}>
          <button
            onClick={() => navigate('/dashboard/settings')}
            title="Settings"
            style={{
              width: '100%', background: 'none', border: 'none',
              padding: collapsed ? '8px 0' : '8px',
              borderRadius: 7, fontSize: 12,
              color: '#6B6560', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 7,
              justifyContent: collapsed ? 'center' : 'flex-start',
              fontFamily: 'DM Sans, sans-serif',
              minHeight: 36, transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <GearIcon />
            {!collapsed && 'Settings'}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar (bottom sheet) */}
      <aside
        className="goblin-sidebar-mobile"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          maxHeight: '82dvh',
          background: '#F2EDE4',
          borderRadius: '18px 18px 0 0',
          borderTop: '1px solid #DDD7CC',
          display: 'flex', flexDirection: 'column',
          zIndex: 40,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: isOpen ? '0 -8px 40px rgba(0,0,0,0.2)' : 'none',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {/* Drag handle */}
        <div
          onClick={onClose}
          style={{
            display: 'flex', justifyContent: 'center',
            padding: '10px 0 6px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#C8C0B4' }} />
        </div>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '4px 16px 12px', flexShrink: 0,
        }}>
          <div
            onClick={() => navigate('/dashboard')}
            style={{
              fontFamily: 'Fraunces, serif', fontSize: 17,
              color: '#2D4A2B', fontWeight: 700, letterSpacing: '-0.3px',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            Goblin<span style={{ opacity: 0.45 }}>.</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            color: '#8C857A', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}>×</button>
        </div>

        {/* New Project */}
        <div style={{ padding: '10px 12px', flexShrink: 0 }}>
          <button
            onClick={() => { setShowNewProjectModal(true); onClose?.(); }}
            style={{
              width: '100%', background: '#2D4A2B', color: '#fff',
              border: 'none', borderRadius: 8, padding: '9px 12px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s', minHeight: 36,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#3A5A37')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
            New Project
          </button>
        </div>

        {/* Projects */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            padding: '4px 16px 6px', fontSize: 10, fontWeight: 600,
            letterSpacing: '1.2px', textTransform: 'uppercase', color: '#9C9589',
          }}>Projects</div>
          <div style={{ padding: '0 8px 8px' }}>
            {projects.map((p, i) => {
              const active = activeProjectId === p.id;
              const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/dashboard/project/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 1,
                    background: active ? 'rgba(212,169,74,0.13)' : 'transparent',
                    border: active ? '1px solid rgba(212,169,74,0.25)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? '#2D4A2B' : '#2A2A2A',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'DM Sans, sans-serif',
                  }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#9C9589', flexShrink: 0 }}>
                    {timeAgo(p.updated_at ?? p.last_active)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #DDD7CC', flexShrink: 0 }}>
          <button
            onClick={() => navigate('/dashboard/settings')}
            style={{
              width: '100%', background: 'none', border: 'none',
              padding: '8px', borderRadius: 7, fontSize: 12,
              color: '#6B6560', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: 'DM Sans, sans-serif', minHeight: 36, transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <GearIcon /> Settings
          </button>
        </div>
      </aside>

      <style>{`
        @media (min-width: 769px) { .goblin-sidebar-mobile { display: none !important; } }
        @media (max-width: 768px) { .goblin-sidebar-desktop { display: none !important; } }
      `}</style>
    </>
  );
}
