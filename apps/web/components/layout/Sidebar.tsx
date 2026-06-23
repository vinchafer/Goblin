'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/app-context';
import { useDemoMode } from '@/lib/demo/demo-mode-context';
import { isDemoActive } from '@/lib/demo/demo-flag';
import { createClient } from '@/lib/supabase/client';
import { apiGet } from '@/lib/api';
import { Gear } from '@phosphor-icons/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { RecentChatRow } from '@/components/sidebar/RecentChatRow';
import { ProjectRowMenu } from '@/components/sidebar/ProjectRowMenu';
import { SidebarUsage } from '@/components/sidebar/SidebarUsage';
import { useLang, t } from '@/lib/use-lang';
import { useUser } from '@/lib/hooks/useUser';

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
  isOpen?: boolean;          // mobile overlay open
  onClose?: () => void;      // mobile close
}

const PROJECT_COLORS = [
  'var(--brand-gold)', 'var(--success)', '#7A4A8A',
  '#3A6B8A', 'var(--danger)', '#4A7A7A', 'var(--brand-green)',
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

// F-W2-a smart-resume: clicking a project routes to the live build window when
// this project has build view-state, else to the hub (unchanged default). Reads
// only the keys project-workspace already writes — no fetch, no schema. wsTab is
// same-tab; lastWsTab is the cross-restart mirror.
function resolveProjectHref(id: string): string {
  const hub = `/dashboard/project/${id}`;
  let tab: string | null = null;
  try { tab = sessionStorage.getItem(`goblin:wsTab:${id}`); } catch { /* ignore */ }
  if (tab == null) {
    try { tab = localStorage.getItem(`goblin:lastWsTab:${id}`); } catch { /* ignore */ }
  }
  return tab === 'code' || tab === 'preview'
    ? `${hub}/work?tab=${tab}`
    : hub;
}

export function Sidebar({ projects = [], activeProjectId, isOpen = false, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lang = useLang();
  const demoMode = useDemoMode();
  const { setShowNewProjectModal, setShowSettingsSheet } = useApp();
  const { fullName, email, plan } = useUser();

  const [userCollapsed, setUserCollapsed] = useState(false);
  const [viewportNarrow, setViewportNarrow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default: open on desktop, collapsed on mobile
      const isMobile = window.innerWidth < 768;
      setUserCollapsed(stored !== null ? stored === 'true' : isMobile);
    }
    setMounted(true);
  }, []);

  // Below 960px (splitscreen / just-desktop) the 260px rail crowds the main
  // pane, so force the collapsed strip regardless of stored preference. Drawer
  // mode takes over below 768 (CSS). Guarantees no broken intermediate render.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 959px)');
    setViewportNarrow(mq.matches);
    const on = () => setViewportNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Forced collapsed when the viewport is narrow; otherwise user-controlled.
  const collapsed = userCollapsed || viewportNarrow;

  const toggle = () => {
    const next = !userCollapsed;
    setUserCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const displayName = fullName || email?.split('@')[0] || 'Builder';
  const initial = displayName.charAt(0).toUpperCase();

  const navigate = (path: string) => {
    if (demoMode) return; // Sprint 10 §6: sidebar nav is inert in demo.
    router.push(path);
    onClose?.();
  };

  // Demo (Sprint 10 §6): the "+" project / settings handlers are no-ops.
  const openNewProject = () => { if (!demoMode) setShowNewProjectModal(true); onClose?.(); };
  const openSettings = () => { if (!demoMode) setShowSettingsSheet(true); onClose?.(); };

  const sidebarWidth = collapsed ? 48 : 280;

  if (!mounted) return null;

  return (
    <>
      {/* Mobile backdrop. NAVFIX-5 (Phase B): z-index lifted to 1000/1001 so the
          overlay reliably opens ABOVE the full-height code surface (gb-codetab)
          and its internal stacking — previously z39/40 could be trapped under the
          code tab on mobile, leaving no way to reach the project rows. */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
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
        {/* ── Collapsed strip: toggle alone, 12px top padding. When expanded the
            toggle lives in the PROJEKTE header row below, so there is no
            standalone toggle row — PROJEKTE starts at the very top. ── */}
        {collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '12px 8px', flexShrink: 0,
          }}>
            <button
              onClick={toggle}
              title="Sidebar ausklappen"
              aria-label="Sidebar ausklappen"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(45,74,43,0.08)',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--brand-green)', flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.08)')}
            >
              <PanelLeftOpen size={18} strokeWidth={1} />
            </button>
          </div>
        )}

        {/* ── Projects List (content-fit, scrolls internally past ~30vh).
            Header row carries the PROJEKTE eyebrow plus the "+" and collapse
            toggle, so PROJEKTE sits at the top with only 12px of breathing
            room. Hidden entirely when collapsed. ── */}
        {!collapsed && (
        <div style={{ flexShrink: 0, maxHeight: '30vh', overflowY: 'auto', minHeight: 0, paddingTop: 0 }}>
            <div style={{
              padding: '12px 12px 6px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button
                onClick={() => navigate('/dashboard/projects')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 'var(--t-eyebrow-fs)', fontWeight: 600, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--ink-3)',
                  fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                }}
              >
                Projekte
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); openNewProject(); }}
                  title="Neues Projekt"
                  aria-label="Neues Projekt"
                  data-testid="sidebar-projects-plus"
                  style={{
                    background: 'var(--brand-header)', border: 'none', cursor: 'pointer',
                    padding: 0, borderRadius: 7, color: 'var(--bone, #F4ECD8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, transition: 'opacity 0.12s, transform 0.12s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <button
                  onClick={toggle}
                  title="Sidebar einklappen"
                  aria-label="Sidebar einklappen"
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = 'var(--ink-1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)'; }}
                >
                  <PanelLeftClose size={15} strokeWidth={1} />
                </button>
              </div>
            </div>

          {projects.length === 0 ? (
            !collapsed && (
              <div style={{
                padding: '8px 16px', fontSize: 'var(--t-small-fs)',
                color: 'var(--text-faint)', fontStyle: 'italic',
                fontFamily: 'var(--font-sans)',
              }}>
                {t(lang, 'Noch keine Projekte', 'No projects yet')}
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
                    onClick={() => navigate(resolveProjectHref(p.id))}
                    title={collapsed ? p.name : undefined}
                    style={{
                      // Matches RecentChatRow spec so both lists read as one
                      // row type (6px/8px padding, radius 6, gap 8).
                      display: 'flex', alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6, cursor: 'pointer', marginBottom: 1,
                      background: active ? 'rgba(212,169,74,0.13)' : 'transparent',
                      border: '1px solid transparent',
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
                          fontSize: 'var(--t-small-fs)', fontWeight: active ? 600 : 400,
                          color: active ? 'var(--brand-green)' : 'var(--text)',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-sans)',
                        }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', flexShrink: 0 }}>
                          {timeAgo(p.updated_at ?? p.last_active)}
                        </span>
                        <ProjectRowMenu project={{ id: p.id, name: p.name }} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* ── Recent Chats (fills remaining height, scrolls internally) ── */}
        {!collapsed && (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <RecentChats pathname={pathname} navigate={navigate} projects={projects} />
          </div>
        )}

        {/* ── Usage summary ── */}
        {!collapsed && <SidebarUsage />}

        {/* ── User Pill (Settings entry-point) — expanded only; pinned to the
            bottom by the flex:1 chats list above so it never drifts upward.
            Hidden in the collapsed strip (settings stay reachable via the
            header avatar menu). ── */}
        {!collapsed && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={openSettings}
              data-testid="user-pill-desktop"
              aria-label="Profil & Einstellungen"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 24,
                background: 'var(--panel, #fff)',
                border: '1px solid var(--border)',
                cursor: 'pointer', minHeight: 40,
                fontFamily: 'var(--font-sans)',
                justifyContent: 'flex-start',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--panel, #fff)')}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--brand-green)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 'var(--t-small-fs)', flexShrink: 0,
              }}>{initial}</span>
              <span style={{
                fontSize: 'var(--t-small-fs)', fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayName}
              </span>
              <Gear size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            </button>
          </div>
        )}
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
          zIndex: 1001,
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
        {/* Header row — close only. Wordmark removed: it lives in the app
            header, and the duplicate here rendered as low-contrast,
            unreadable text between the top edge and PROJEKTE (C2). */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '12px 20px 8px 20px', flexShrink: 0,
        }}>
          <button onClick={onClose} aria-label="Close sidebar" style={{
            background: 'rgba(0,0,0,0.04)', border: 'none', fontSize: 'var(--t-h4-fs)',
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
              onClick={() => navigate('/dashboard/projects')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 'var(--t-eyebrow-fs)', fontWeight: 600, letterSpacing: '1.2px',
                textTransform: 'uppercase', color: 'var(--ink-3)',
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              }}
            >
              Projekte
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowNewProjectModal(true); onClose?.(); }}
              data-testid="sidebar-new-project"
              aria-label="Neues Projekt"
              style={{
                background: 'var(--brand-header)', border: 'none', cursor: 'pointer',
                padding: 0, borderRadius: 7, color: 'var(--bone, #F4ECD8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div style={{ padding: '0 12px 8px' }}>
            {projects.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 'var(--t-small-fs)', color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                {t(lang, 'Noch keine Projekte', 'No projects yet')}
              </div>
            ) : projects.map((p, i) => {
              const active = activeProjectId === p.id;
              const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(resolveProjectHref(p.id))}
                  style={{
                    // Matches RecentChatRow / desktop project row spec so the
                    // project and chat lists read as one row type in the drawer.
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 1,
                    background: active ? 'rgba(212,169,74,0.13)' : 'transparent',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 'var(--t-small-fs)', fontWeight: active ? 600 : 400,
                    color: active ? 'var(--brand-green)' : 'var(--text)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-sans)',
                  }}>{p.name}</span>
                  <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', flexShrink: 0 }}>
                    {timeAgo(p.updated_at ?? p.last_active)}
                  </span>
                  <ProjectRowMenu project={{ id: p.id, name: p.name }} onChanged={onClose} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Chats */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <RecentChats pathname={pathname} navigate={navigate} />
        </div>

        {/* Usage summary */}
        <SidebarUsage />

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
              fontFamily: 'var(--font-sans)',
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--brand-green)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 'var(--t-small-fs)', flexShrink: 0,
            }}>{initial}</span>
            <span style={{ fontSize: 'var(--t-small-fs)', fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </span>
            <span style={{
              fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--green-700)',
              background: 'var(--accent-soft)', borderRadius: 'var(--radius-xs)',
              padding: '1px 6px', flexShrink: 0,
            }}>{plan.name}</span>
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

function RecentChats({ pathname, navigate, projects = [] }: { pathname: string; navigate: (path: string) => void; projects?: Project[] }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const lang = useLang();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  const loadSessions = useCallback(async () => {
    // Demo (Sprint 10 §7): no chat-session fetch → empty "No chats yet" state.
    if (isDemoActive()) { setSessions([]); setLoading(false); return; }
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
    if (isDemoActive()) return; // Sprint 10 §6: inert in demo.
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
          onClick={() => navigate('/dashboard/chats')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 'var(--t-eyebrow-fs)', fontWeight: 600, letterSpacing: '1.2px',
            textTransform: 'uppercase', color: 'var(--text-faint)',
            fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
          }}
        >
          Chats
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleNewChat(); }}
          title="Neuer Chat"
          aria-label="Neuer Chat"
          data-testid="sidebar-chats-plus"
          style={{
            background: 'var(--brand-header)', border: 'none', cursor: 'pointer',
            padding: 0, borderRadius: 7, color: 'var(--bone, #F4ECD8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, transition: 'opacity 0.12s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
          <div style={{ padding: '4px 8px', fontSize: 'var(--t-small-fs)', color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
            {t(lang, 'Noch keine Chats', 'No chats yet')}
          </div>
        ) : (
          <>
            {sessions.map(s => (
              <RecentChatRow
                key={s.id}
                chat={s}
                projects={projects}
                active={pathname.includes(s.id)}
                onNavigate={(id) => navigate(`/dashboard/chat/${id}`)}
                onUpdate={loadSessions}
              />
            ))}
            {sessions.length === 5 && (
              <button
                onClick={() => navigate('/dashboard/chats')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', padding: '4px 8px', fontFamily: 'var(--font-sans)', width: '100%', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-green)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
              >
                Alle Chats →
              </button>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
