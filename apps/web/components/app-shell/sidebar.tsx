'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/app-context';
import { useBuildStatus } from '@/contexts/build-context';
import {
  Plus,
  Folder,
  ChatsCircle,
  Gear,
  Key,
  ChartBar,
  ArrowSquareOut,
  SignOut,
  CaretLeft,
  CaretRight,
  User,
} from '@phosphor-icons/react';

interface Project {
  id: string;
  name: string;
  color?: string;
  status?: string;
  updated_at?: string;
  last_active?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at?: string;
}

interface SidebarProps {
  projects?: Project[];
  chats?: ChatSession[];
  activeProjectId?: string;
  onProjectSelect?: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  const w = Math.floor(diff / 604800000);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return `${w}w`;
}

const MAX_VISIBLE_PROJECTS = 8;
const MAX_VISIBLE_CHATS = 5;
const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 48;

export function Sidebar({ projects = [], chats = [], activeProjectId, onProjectSelect, isOpen = true, onClose }: SidebarProps) {
  const router = useRouter();
  const { setShowNewProjectModal } = useApp();
  const { isBuilding, progress, currentAction } = useBuildStatus();
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('goblin_sidebar_collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        if (data.user) {
          setUserEmail(data.user.email ?? '');
          const name = data.user.user_metadata?.display_name
            ?? data.user.user_metadata?.full_name
            ?? data.user.email?.split('@')[0]
            ?? '';
          setUserName(name);
        }
      });
    });
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('goblin_sidebar_collapsed', String(next));
  };

  const handleSignOut = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const visibleProjects = projects.slice(0, MAX_VISIBLE_PROJECTS);
  const hiddenProjectCount = projects.length - MAX_VISIBLE_PROJECTS;
  const visibleChats = chats.slice(0, MAX_VISIBLE_CHATS);
  const avatarInitial = (userName || userEmail)[0]?.toUpperCase() ?? '?';

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  const QuickLink = ({ icon: Icon, label, path, external }: { icon: React.ElementType; label: string; path: string; external?: boolean }) => (
    <button
      onClick={() => { if (external) window.open(path, '_blank'); else { router.push(path); onClose?.(); } }}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8,
        width: '100%', background: 'none', border: 'none',
        padding: collapsed ? '8px 0' : '7px 8px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 6, fontSize: 12, color: 'var(--meta)', cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif', transition: 'background 0.1s, color 0.1s',
        minHeight: 32,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle)'; e.currentTarget.style.color = 'var(--text)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--meta)'; }}
    >
      <Icon size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
      {!collapsed && <span>{label}</span>}
      {!collapsed && external && <ArrowSquareOut size={10} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
    </button>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className="sidebar-backdrop"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40, display: 'none' }}
      />

      <aside
        className={`goblin-sidebar${isOpen ? ' goblin-sidebar-open' : ''}`}
        style={{
          width: sidebarWidth,
          background: 'var(--cream)',
          borderRight: '1px solid var(--div)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100%',
          transition: 'width 0.2s ease, transform 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Mobile drag handle */}
        <div className="goblin-sidebar-handle" onClick={onClose}>
          <div />
        </div>

        {/* HEADER — Logo + Collapse toggle */}
        <div style={{
          padding: collapsed ? '12px 0' : '12px 12px 10px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--div)',
          minHeight: 48,
        }}>
          {!collapsed && (
            <span style={{
              fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)',
              fontWeight: 700, letterSpacing: '-0.5px', userSelect: 'none',
            }}>
              Goblin<span style={{ color: 'var(--ochre)' }}>.</span>
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            className="desktop-only"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--meta)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--meta)'; }}
          >
            {collapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
          </button>
        </div>

        {/* NEW PROJECT CTA */}
        <div style={{ padding: collapsed ? '10px 6px' : '10px 10px 8px', flexShrink: 0 }}>
          <button
            onClick={() => { setShowNewProjectModal(true); onClose?.(); }}
            title={collapsed ? 'New Project' : undefined}
            style={{
              width: '100%',
              background: 'var(--moss)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: collapsed ? '9px 0' : '9px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 6,
              fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
              minHeight: 36,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >
            <Plus size={14} weight="bold" style={{ flexShrink: 0 }} />
            {!collapsed && <span>New Project</span>}
          </button>
        </div>

        {/* SCROLL AREA */}
        <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '0 6px' : '0 8px' }}>

          {/* PROJECTS SECTION */}
          {!collapsed && (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '1.2px',
              textTransform: 'uppercase', color: 'var(--meta)',
              padding: '8px 4px 4px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>Projects</span>
              {projects.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--disabled)', fontWeight: 500 }}>
                  {projects.length}
                </span>
              )}
            </div>
          )}
          {collapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <Folder size={14} style={{ color: 'var(--meta)', opacity: 0.6 }} />
            </div>
          )}

          {projects.length === 0 && !collapsed ? (
            <div style={{ padding: '6px 4px 8px', fontSize: 12, color: 'var(--meta)', fontStyle: 'italic' }}>
              No projects yet
            </div>
          ) : (
            <>
              {visibleProjects.map(p => {
                const active = activeProjectId === p.id;
                const dotColor = p.color ?? 'var(--ochre)';
                return (
                  <div
                    key={p.id}
                    onClick={() => { onProjectSelect?.(p.id); router.push(`/dashboard/project/${p.id}`); onClose?.(); }}
                    title={collapsed ? p.name : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 8,
                      padding: collapsed ? '8px 0' : '7px 8px 7px 10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                      background: active ? 'rgba(45,74,43,0.07)' : 'transparent',
                      borderLeft: collapsed ? 'none' : (active ? '3px solid var(--ochre)' : '3px solid transparent'),
                      transition: 'all 0.1s', minHeight: 32,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--subtle)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    {!collapsed && (
                      <>
                        <span style={{
                          fontSize: 12, fontWeight: active ? 600 : 500,
                          color: 'var(--text)', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--meta)', flexShrink: 0 }}>
                          {timeAgo(p.updated_at ?? p.last_active)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
              {hiddenProjectCount > 0 && !collapsed && (
                <button
                  onClick={() => router.push('/dashboard')}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '5px 8px', borderRadius: 6, fontSize: 11,
                    color: 'var(--meta)', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
                >
                  All projects ({projects.length}) →
                </button>
              )}
            </>
          )}

          {/* CHATS SECTION */}
          {chats.length > 0 && (
            <>
              {!collapsed && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--meta)',
                  padding: '12px 4px 4px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>Chats</span>
                  <span style={{ fontSize: 10, color: 'var(--disabled)', fontWeight: 500 }}>
                    {chats.length}
                  </span>
                </div>
              )}
              {collapsed && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
                  <ChatsCircle size={14} style={{ color: 'var(--meta)', opacity: 0.6 }} />
                </div>
              )}
              {visibleChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => { router.push(`/dashboard/chat/${chat.id}`); onClose?.(); }}
                  title={collapsed ? chat.title : undefined}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 8,
                    padding: collapsed ? '8px 0' : '6px 8px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 6, cursor: 'pointer', marginBottom: 1,
                    transition: 'background 0.1s', minHeight: 30,
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--subtle)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  {collapsed
                    ? <ChatsCircle size={13} style={{ color: 'var(--meta)', opacity: 0.6 }} />
                    : (
                      <span style={{
                        fontSize: 12, color: 'var(--text-2)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {chat.title}
                      </span>
                    )
                  }
                </div>
              ))}
              {chats.length > MAX_VISIBLE_CHATS && !collapsed && (
                <button
                  onClick={() => router.push('/dashboard/chat')}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '5px 8px', borderRadius: 6, fontSize: 11,
                    color: 'var(--meta)', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
                >
                  All chats ({chats.length}) →
                </button>
              )}
            </>
          )}
        </div>

        {/* BUILD STATUS */}
        {isBuilding && !collapsed && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--div)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ochre)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-code)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {currentAction ?? 'Building…'}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--div)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--ochre)', width: `${progress ?? 0}%`, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* QUICK LINKS */}
        <div style={{ padding: collapsed ? '8px 6px' : '8px 8px', borderTop: '1px solid var(--div)', flexShrink: 0 }}>
          <QuickLink icon={Gear} label="Settings" path="/dashboard/settings" />
          <QuickLink icon={Key} label="API Keys" path="/dashboard/settings/keys" />
          <QuickLink icon={ChartBar} label="Usage" path="/dashboard/usage" />
          <QuickLink icon={ArrowSquareOut} label="Docs" path="https://docs.goblin.app" external />
        </div>

        {/* USER MENU */}
        <div style={{
          padding: collapsed ? '8px 6px' : '8px 10px',
          borderTop: '1px solid var(--div)', flexShrink: 0,
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 52,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--moss)', color: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans, sans-serif',
            cursor: 'pointer',
          }}
            title={collapsed ? `${userName || userEmail}\nSign out` : undefined}
            onClick={collapsed ? handleSignOut : undefined}
          >
            {avatarInitial}
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userName || userEmail.split('@')[0]}
                </div>
                <div style={{ fontSize: 10, color: 'var(--meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign out"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--meta)', padding: 5, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.1s, color 0.1s', flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle)'; e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--meta)'; }}
              >
                <SignOut size={14} />
              </button>
            </>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .goblin-sidebar { position: relative; z-index: 41; }
        @media (max-width: 768px) {
          .goblin-sidebar {
            position: fixed !important;
            bottom: 0; left: 0; right: 0;
            top: auto !important;
            width: 100% !important;
            max-height: 82dvh;
            border-radius: 18px 18px 0 0;
            border-right: none !important;
            border-top: 1px solid var(--div);
            transform: translateY(100%);
            z-index: 41;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }
          .goblin-sidebar.goblin-sidebar-open {
            transform: translateY(0) !important;
            box-shadow: 0 -8px 40px rgba(0,0,0,0.22);
          }
          .goblin-sidebar-handle { display: flex !important; }
          .sidebar-backdrop { display: block !important; }
        }
        .goblin-sidebar-handle {
          display: none;
          justify-content: center;
          padding: 10px 0 4px;
          cursor: grab;
          flex-shrink: 0;
        }
        .goblin-sidebar-handle div {
          width: 36px; height: 4px;
          border-radius: 2px;
          background: var(--border);
        }
      `}</style>
    </>
  );
}
