'use client';
import { useRouter } from 'next/navigation';

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

export function Sidebar({ projects = [], activeProjectId, onProjectSelect, isOpen = true, onClose }: SidebarProps) {
  const router = useRouter();
  const colors = ['#c9933a', '#4a7c3b', '#7a4a8a', '#3a6b8a', '#8a3a3a', '#4a7a7a'];
  const getColor = (index: number) => colors[index % colors.length];

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return 'now';
    if (h < 24) return `${h}h`;
    return `${d}d`;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
          className="sidebar-overlay"
        />
      )}

      <aside
        style={{
          width: 220,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto',
          transition: 'transform 0.25s ease',
          height: '100%',
        }}
        className={`goblin-sidebar ${isOpen ? 'goblin-sidebar-open' : ''}`}
      >
        {/* Projects */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => router.push('/dashboard/new')}
            style={{
              width: '100%', background: 'var(--moss)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 12, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> New Project
          </button>

          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--meta)', marginBottom: 8, padding: '0 4px' }}>
            Projects
          </div>

          {projects.length === 0 ? (
            <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--meta)', fontStyle: 'italic' }}>
              No projects yet
            </div>
          ) : (
            projects.map((p, i) => (
              <div
                key={p.id}
                onClick={() => {
                  onProjectSelect?.(p.id);
                  router.push(`/dashboard/project/${p.id}`);
                  onClose?.();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                  background: activeProjectId === p.id ? 'rgba(201,147,58,0.1)' : 'transparent',
                  border: activeProjectId === p.id ? '1px solid rgba(201,147,58,0.2)' : '1px solid transparent',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (activeProjectId !== p.id) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={e => { if (activeProjectId !== p.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: getColor(i), flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--meta)', flexShrink: 0 }}>{timeAgo(p.updated_at ?? p.last_active)}</span>
              </div>
            ))
          )}
        </div>

        {/* Build status */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--meta)', marginBottom: 8 }}>Build</div>
          <div style={{ fontSize: 11, color: 'var(--meta)', fontStyle: 'italic' }}>No active builds</div>
        </div>

        {/* Model Routing */}
        <div style={{ padding: 12, marginTop: 'auto', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--meta)', marginBottom: 10 }}>Model Routing</div>
          {[
            { label: 'Goblin Hosted', color: '#c9933a' },
            { label: 'Free-API Pool', color: 'var(--success)' },
            { label: 'BYOK · Anthropic', color: 'var(--success)' },
            { label: 'BYOK · OpenAI', color: 'var(--border)' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: 'var(--meta)' }}>{item.label}</span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
            </div>
          ))}
        </div>

        {/* Settings link */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => router.push('/dashboard/settings')}
            style={{ width: '100%', background: 'none', border: 'none', padding: '6px 8px', borderRadius: 7, fontSize: 12, color: 'var(--meta)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            ⚙ Settings
          </button>
        </div>
      </aside>

      <style>{`
        .goblin-sidebar { position: relative; z-index: 41; }
        .sidebar-overlay { display: none; }
        @media (max-width: 768px) {
          .goblin-sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            z-index: 41;
            transform: translateX(-100%);
          }
          .goblin-sidebar.goblin-sidebar-open { transform: translateX(0) !important; }
          .sidebar-overlay { display: block !important; }
        }
      `}</style>
    </>
  );
}
