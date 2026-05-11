'use client';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/app-context';
import { useBuildStatus } from '@/contexts/build-context';

interface Project {
  id: string;
  name: string;
  color?: string;
  status?: string;
  updated_at?: string;
  last_active?: string;
}

interface SidebarProps {
  projects?: Project[];
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

const MAX_VISIBLE = 8;

export function Sidebar({ projects = [], activeProjectId, onProjectSelect, isOpen = true, onClose }: SidebarProps) {
  const router = useRouter();
  const { setShowNewProjectModal } = useApp();
  const { isBuilding, progress, currentAction } = useBuildStatus();

  const visibleProjects = projects.slice(0, MAX_VISIBLE);
  const hiddenCount = projects.length - MAX_VISIBLE;

  const handleSignOut = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

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
          width: 220,
          background: 'var(--cream)',
          borderRight: '1px solid var(--div)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100%',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Mobile drag handle */}
        <div className="goblin-sidebar-handle" onClick={onClose}>
          <div />
        </div>

        {/* SECTION 1 — New Project */}
        <div style={{ padding: '12px 12px 10px', flexShrink: 0 }}>
          <button
            onClick={() => { setShowNewProjectModal(true); onClose?.(); }}
            style={{
              width: '100%',
              background: 'var(--ochre)',
              color: '#1a1200',
              border: 'none',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
              minHeight: 36,
              letterSpacing: '0.1px',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ochre-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ochre)')}
          >
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: -1 }}>+</span>
            Neues Projekt
          </button>
        </div>

        {/* SECTION 2 — Project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            textTransform: 'uppercase', color: 'var(--meta)',
            padding: '0 4px', marginBottom: 6,
          }}>
            Projekte
          </div>

          {projects.length === 0 ? (
            <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--meta)', fontStyle: 'italic' }}>
              Noch keine Projekte
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 8px 7px 10px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      marginBottom: 2,
                      background: active ? 'rgba(45,74,43,0.07)' : 'transparent',
                      borderLeft: active ? '3px solid var(--ochre)' : '3px solid transparent',
                      transition: 'all 0.1s',
                      minHeight: 32,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
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
                  </div>
                );
              })}

              {hiddenCount > 0 && (
                <button
                  onClick={() => router.push('/dashboard')}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '6px 8px', borderRadius: 7, fontSize: 11,
                    color: 'var(--meta)', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
                >
                  Alle anzeigen ({projects.length})
                </button>
              )}
            </>
          )}
        </div>

        {/* SECTION 3 — Build Status (only when active) */}
        {isBuilding && (
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--div)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--ochre)',
                  display: 'inline-block',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }} />
                <span style={{
                  fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-code)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 120,
                }}>
                  {currentAction ?? 'Building…'}
                </span>
              </div>
              <button style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 5,
                padding: '2px 7px', fontSize: 10, color: 'var(--meta)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
              }}>
                ■ Stop
              </button>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--div)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'var(--ochre)',
                width: `${progress ?? 0}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--meta)', marginTop: 4, textAlign: 'right' }}>
              {progress ?? 0}%
            </div>
          </div>
        )}

        {/* SECTION 4 — Quick Links */}
        <div style={{
          padding: '8px 12px 10px',
          borderTop: '1px solid var(--div)',
          flexShrink: 0,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}>
          {[
            { label: 'Einstellungen', path: '/dashboard/settings', icon: '⚙' },
            { label: 'Usage', path: '/dashboard/usage', icon: '◌' },
            { label: 'Hilfe', path: 'https://docs.goblin.app', icon: '?' },
          ].map(({ label, path, icon }) => (
            <button
              key={path}
              onClick={() => { router.push(path); onClose?.(); }}
              style={{
                flex: 1, background: 'none', border: 'none',
                padding: '5px 4px', borderRadius: 6, fontSize: 10,
                color: 'var(--meta)', cursor: 'pointer',
                textAlign: 'center', fontFamily: 'DM Sans, sans-serif',
                transition: 'background 0.1s, color 0.1s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(0,0,0,0.04)'); (e.currentTarget.style.color = 'var(--text)'); }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = 'var(--meta)'); }}
            >
              <span style={{ fontSize: 11 }}>{icon}</span>
              {label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            style={{
              flex: 1, background: 'none', border: 'none',
              padding: '5px 4px', borderRadius: 6, fontSize: 10,
              color: 'var(--meta)', cursor: 'pointer',
              textAlign: 'center', fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.1s, color 0.1s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(0,0,0,0.04)'); (e.currentTarget.style.color = 'var(--text)'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = 'var(--meta)'); }}
          >
            <span style={{ fontSize: 11 }}>→</span>
            Abmelden
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
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
          .goblin-sidebar-handle {
            display: flex !important;
          }
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
