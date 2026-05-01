'use client';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/app-context';

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

const COLORS = ['#c9933a', '#4a7c3b', '#7a4a8a', '#3a6b8a', '#8a3a3a', '#4a7a7a'];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h`;
  return `${d}d`;
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
          background: '#f7f3ec',
          borderRight: '1px solid #e4ddd2',
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

        {/* ── Projects ── */}
        <div style={{ padding: 12, borderBottom: '1px solid #e4ddd2', flexShrink: 0 }}>
          <button
            onClick={() => { setShowNewProjectModal(true); onClose?.(); }}
            style={{
              width: '100%', background: '#2D4A2B', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 12, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
              minHeight: 36,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#3A5A37')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
          >
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>＋</span>
            New Project
          </button>

          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 8, padding: '0 4px' }}>
            PROJECTS
          </div>

          {projects.length === 0 ? (
            <div style={{ padding: '10px 8px', fontSize: 12, color: '#6b6560', fontStyle: 'italic' }}>
              No projects yet
            </div>
          ) : (
            projects.map((p, i) => {
              const active = activeProjectId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => { onProjectSelect?.(p.id); router.push(`/project/${p.id}`); onClose?.(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                    background: active ? 'rgba(201,147,58,0.1)' : 'transparent',
                    border: active ? '1px solid rgba(201,147,58,0.2)' : '1px solid transparent',
                    transition: 'all 0.1s',
                    minHeight: 32,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#6b6560', flexShrink: 0 }}>{timeAgo(p.updated_at ?? p.last_active)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* ── Build Status ── */}
        {/* Only shown when there's an active deploy in the last 10 minutes */}
        {/* For now, we don't have project data, so we'll hide it */}
        {/* 
        <div style={{ padding: 12, borderBottom: '1px solid #e4ddd2', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b6560', marginBottom: 10 }}>
            Build
          </div>
          <div style={{ padding: '8px 0', fontSize: 11, color: '#6b6560', fontStyle: 'italic' }}>
            No active deployments
          </div>
        </div>
        */}

        {/* ── Model Routing ── */}
        <div style={{ padding: 12, marginTop: 'auto', borderTop: '1px solid #e4ddd2', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b6560', marginBottom: 10 }}>
            Model Routing
          </div>
          {[
            { label: 'Goblin Hosted', color: '#c9933a', active: true },
            { label: 'Free-API Pool', color: '#4a7c3b', active: true },
            { label: 'BYOK · Anthropic', color: '#4a7c3b', active: true },
            { label: 'BYOK · OpenAI', color: '#e4ddd2', active: false },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#6b6560', fontFamily: 'DM Sans, sans-serif' }}>{item.label}</span>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: item.color,
                boxShadow: item.active ? `0 0 4px ${item.color}` : 'none',
              }} />
            </div>
          ))}
        </div>

        {/* ── Settings ── */}
        <div style={{ padding: 12, borderTop: '1px solid #e4ddd2', flexShrink: 0 }}>
          <button
            onClick={() => { router.push('/dashboard/settings'); onClose?.(); }}
            style={{
              width: '100%', background: 'none', border: 'none',
              padding: '8px 8px', borderRadius: 7, fontSize: 12,
              color: '#6b6560', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center',
              gap: 8, fontFamily: 'DM Sans, sans-serif', minHeight: 36,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            ⚙ Settings
          </button>
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
            border-top: 1px solid #e4ddd2;
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
          background: #c8c0b4;
        }
      `}</style>
    </>
  );
}
