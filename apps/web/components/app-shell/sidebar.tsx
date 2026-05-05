'use client';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/app-context';
import { UsageIndicators } from './usage-indicators';

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
  if (h < 1) return 'now';
  if (h < 24) return `${h}h`;
  return `${d}d`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
      textTransform: 'uppercase', color: 'var(--meta)',
      marginBottom: 6, padding: '0 4px',
    }}>
      {children}
    </div>
  );
}

export function Sidebar({ projects = [], activeProjectId, onProjectSelect, isOpen = true, onClose }: SidebarProps) {
  const router = useRouter();
  const { setShowNewProjectModal } = useApp();

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
          overflowY: 'auto',
          height: '100%',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Bottom-sheet drag handle (mobile only) */}
        <div className="goblin-sidebar-handle" onClick={onClose}>
          <div />
        </div>

        {/* ── New Project ── */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--div)', flexShrink: 0 }}>
          <button
            onClick={() => { setShowNewProjectModal(true); onClose?.(); }}
            style={{
              width: '100%', background: 'var(--moss)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 14, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
              minHeight: 36, letterSpacing: '0.1px',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >
            <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0, marginTop: -1 }}>+</span>
            New Project
          </button>

          <SectionLabel>Projects</SectionLabel>

          {projects.length === 0 ? (
            <div style={{ padding: '8px 8px', fontSize: 12, color: 'var(--meta)', fontStyle: 'italic' }}>
              No projects yet
            </div>
          ) : (
            projects.map(p => {
              const active = activeProjectId === p.id;
              const dotColor = p.color ?? 'var(--ochre)';
              return (
                <div
                  key={p.id}
                  onClick={() => { onProjectSelect?.(p.id); router.push(`/dashboard/project/${p.id}`); onClose?.(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                    background: active ? 'rgba(212,169,74,0.1)' : 'transparent',
                    border: active ? '1px solid rgba(212,169,74,0.2)' : '1px solid transparent',
                    transition: 'all 0.1s',
                    minHeight: 32,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--meta)', flexShrink: 0 }}>{timeAgo(p.updated_at ?? p.last_active)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* ── Recent Chats ── */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--div)', flexShrink: 0 }}>
          <SectionLabel>Recent Chats</SectionLabel>
          <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--meta)', fontStyle: 'italic' }}>
            No chats yet
          </div>
        </div>

        {/* ── Usage ── */}
        <div style={{ borderBottom: '1px solid var(--div)', flexShrink: 0 }}>
          <div style={{ padding: '12px 12px 0' }}>
            <SectionLabel>Usage</SectionLabel>
          </div>
          <UsageIndicators />
        </div>

        {/* ── Bottom Links ── */}
        <div style={{ padding: '8px 12px', marginTop: 'auto', flexShrink: 0 }}>
          {[
            { label: 'Billing', path: '/dashboard/settings/billing' },
            { label: 'Settings', path: '/dashboard/settings' },
          ].map(({ label, path }) => (
            <button
              key={path}
              onClick={() => { router.push(path); onClose?.(); }}
              style={{
                width: '100%', background: 'none', border: 'none',
                padding: '7px 8px', borderRadius: 7, fontSize: 12,
                color: 'var(--meta)', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                minHeight: 32, transition: 'background 0.1s',
                display: 'block',
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(0,0,0,0.04)'); (e.currentTarget.style.color = 'var(--text)'); }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = 'var(--meta)'); }}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>

      <style>{`
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
