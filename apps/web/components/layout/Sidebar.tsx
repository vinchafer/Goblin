'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/app-context';
import { createClient } from '@/lib/supabase/client';
import { apiGet } from '@/lib/api';
import { Gear } from '@phosphor-icons/react';

interface ChatSession {
  id: string;
  title: string | null;
  updated_at: string;
  project_id?: string | null;
  project_name?: string | null;
}

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
  'var(--ochre)', 'var(--success)', '#7A4A8A',
  '#3A6B8A', 'var(--danger)', '#4A7A7A', 'var(--moss)',
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
  const { setShowNewProjectModal, setShowSettingsSheet } = useApp();

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
          background: 'var(--subtle)',
          borderRight: '1px solid var(--border)',
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
          borderBottom: '1px solid var(--border)', flexShrink: 0,
          gap: 10, justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          {!collapsed ? (
            <>
              <div
                onClick={() => navigate('/dashboard')}
                style={{
                  fontFamily: 'Fraunces, serif', fontSize: 17,
                  color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.3px',
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
                  border: '1px solid var(--border)',
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
                cursor: 'pointer', color: 'var(--moss)', flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.08)')}
            >
              <ChevronRight small />
            </button>
          )}
        </div>

        {/* ── Projects List ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 8 }}>
          {!collapsed && (
            <div style={{
              padding: '4px 12px 6px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 10, fontWeight: 600, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--text-faint)',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Projects
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowNewProjectModal(true); onClose?.(); }}
                title="New Project"
                aria-label="New Project"
                data-testid="sidebar-projects-plus"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, borderRadius: 4, color: 'var(--text-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,74,43,0.10)'; e.currentTarget.style.color = 'var(--moss)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          )}

          {projects.length === 0 ? (
            !collapsed && (
              <div style={{
                padding: '8px 16px', fontSize: 12,
                color: 'var(--text-faint)', fontStyle: 'italic',
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
                          color: active ? 'var(--moss)' : 'var(--text)',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'DM Sans, sans-serif',
                        }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
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

        {/* ── Recent Chats ── */}
        {!collapsed && <RecentChats pathname={pathname} navigate={navigate} />}

        {/* ── User Pill (Settings entry-point) ── */}
        <div style={{
          padding: collapsed ? '8px' : '10px 12px',
          borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button
            onClick={() => { setShowSettingsSheet(true); onClose?.(); }}
            data-testid="user-pill-desktop"
            title={collapsed ? 'Profil & Einstellungen' : undefined}
            aria-label="Profil & Einstellungen"
            style={{
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
              width: '100%',
              padding: collapsed ? '6px 0' : '8px 10px',
              borderRadius: collapsed ? 10 : 24,
              background: 'var(--panel, #fff)',
              border: '1px solid var(--border)',
              cursor: 'pointer', minHeight: 40,
              fontFamily: 'DM Sans, sans-serif',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--panel, #fff)')}
          >
            <span style={{
              width: collapsed ? 32 : 28, height: collapsed ? 32 : 28, borderRadius: '50%',
              background: 'var(--moss)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>{initial}</span>
            {!collapsed && (
              <span style={{
                fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayName}
              </span>
            )}
            {!collapsed && (
              <Gear size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar — slides from LEFT (Claude/ChatGPT pattern) */}
      <aside
        className="goblin-sidebar-mobile"
        data-testid="mobile-sidebar"
        style={{
          position: 'fixed',
          top: 0, bottom: 0, left: 0,
          width: '85vw', maxWidth: 320,
          background: 'var(--subtle)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          zIndex: 40,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: isOpen ? '8px 0 40px rgba(0,0,0,0.2)' : 'none',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        } as React.CSSProperties}
      >
        {/* Header row — logo + close */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '24px 20px 16px', flexShrink: 0,
        }}>
          <div
            onClick={() => { navigate('/dashboard'); }}
            style={{
              fontFamily: 'Fraunces, serif', fontSize: 28,
              color: 'var(--moss)', fontWeight: 400, letterSpacing: '-0.5px',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            Goblin
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close sidebar" style={{
            background: 'rgba(0,0,0,0.04)', border: 'none', fontSize: 18,
            color: '#8C857A', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 18,
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}>×</button>
        </div>

        {/* Projects */}
        <div style={{ flexShrink: 0, paddingTop: 4 }}>
          <div style={{
            padding: '12px 12px 8px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, fontWeight: 600, letterSpacing: '1.2px',
                textTransform: 'uppercase', color: 'var(--text-faint)',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Projects
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowNewProjectModal(true); onClose?.(); }}
              data-testid="sidebar-new-project"
              aria-label="New Project"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, borderRadius: 4, color: 'var(--text-faint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 32, minHeight: 32,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div style={{ padding: '0 12px 8px' }}>
            {projects.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'DM Sans, sans-serif' }}>
                No projects yet
              </div>
            ) : projects.map((p, i) => {
              const active = activeProjectId === p.id;
              const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/dashboard/project/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                    background: active ? 'rgba(212,169,74,0.13)' : 'transparent',
                    minHeight: 44,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 15, fontWeight: active ? 600 : 400,
                    color: active ? 'var(--moss)' : 'var(--text)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'DM Sans, sans-serif',
                  }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                    {timeAgo(p.updated_at ?? p.last_active)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Chats */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <RecentChats pathname={pathname} navigate={navigate} />
        </div>

        {/* User pill bottom-left (settings entry, not main-nav) */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={() => { setShowSettingsSheet(true); onClose?.(); }}
            aria-label="Account & settings"
            data-testid="user-pill"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%',
              padding: '8px 10px', borderRadius: 24,
              background: 'var(--panel, #fff)',
              border: '1px solid var(--border)',
              cursor: 'pointer', minHeight: 44,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--moss)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>{initial}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </span>
            <Gear size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
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

// ─── Recent Chats ─────────────────────────────────────────────────────────────

function RecentChats({ pathname, navigate }: { pathname: string; navigate: (path: string) => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet<ChatSession[]>('/api/chat-sessions');
      setSessions(data.slice(0, 5));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleNewChat = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${apiBase}/api/chat-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const s = await res.json() as { id: string };
        navigate(`/dashboard/chat/${s.id}`);
        loadSessions();
      }
    } catch { /* ignore */ }
  };

  function timeAgoShort(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return 'now';
    if (h < 24) return `${h}h`;
    return `${d}d`;
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 6px 16px' }}>
        <button
          onClick={() => navigate('/dashboard/chat')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 10, fontWeight: 600, letterSpacing: '1.2px',
            textTransform: 'uppercase', color: 'var(--text-faint)',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Recent Chats
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleNewChat(); }}
          title="New chat"
          aria-label="New chat"
          data-testid="sidebar-chats-plus"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, borderRadius: 4, color: 'var(--text-faint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,74,43,0.10)'; e.currentTarget.style.color = 'var(--moss)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-faint)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '0 8px 8px' }}>
        {loading ? (
          [1, 2].map(i => (
            <div key={i} style={{ height: 28, borderRadius: 6, background: 'var(--div)', marginBottom: 2, animation: 'pulse 1.5s ease infinite' }} />
          ))
        ) : sessions.length === 0 ? (
          <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'DM Sans, sans-serif' }}>
            No chats yet
          </div>
        ) : (
          <>
            {sessions.map(s => {
              const active = pathname.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/dashboard/chat/${s.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 1,
                    background: active ? 'rgba(212,169,74,0.1)' : 'transparent',
                    borderLeft: active ? '2px solid var(--ochre)' : '2px solid transparent',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      fontSize: 12, color: active ? 'var(--moss)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: 'DM Sans, sans-serif', fontWeight: active ? 600 : 400,
                    }}>
                      {s.title || 'New chat'}
                    </span>
                    {s.project_name && (
                      <span style={{
                        fontSize: 10, color: 'var(--text-faint)',
                        background: 'rgba(0,0,0,0.05)', padding: '1px 6px',
                        borderRadius: 5, alignSelf: 'flex-start',
                        fontFamily: 'DM Sans, sans-serif', maxWidth: '100%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        📁 {s.project_name}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
                    {timeAgoShort(s.updated_at)}
                  </span>
                </div>
              );
            })}
            {sessions.length === 5 && (
              <button
                onClick={() => navigate('/dashboard/chat')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-faint)', padding: '4px 8px', fontFamily: 'DM Sans, sans-serif', width: '100%', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--moss)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
              >
                See all chats →
              </button>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
