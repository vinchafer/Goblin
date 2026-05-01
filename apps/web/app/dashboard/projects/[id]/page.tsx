'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  github_repo: string | null;
  preview_url: string | null;
  storage_path: string | null;
  last_active: string | null;
}

type Tab = 'storage' | 'chats' | 'skills' | 'links';

const TAB_LABELS: { id: Tab; label: string; icon: string }[] = [
  { id: 'storage', label: 'Files', icon: '📁' },
  { id: 'chats',   label: 'Chats',  icon: '💬' },
  { id: 'skills',  label: 'Context', icon: '📎' },
  { id: 'links',   label: 'Links',   icon: '🔗' },
];

function FilesTab({ projectId, token }: { projectId: string; token: string }) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiBase}/api/projects/${projectId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => setFiles(data))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [projectId, token]);

  const handleDownload = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${apiBase}/api/projects/${projectId}/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `project-${projectId}.zip`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ padding: 24, color: '#9C9589', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Loading files…</div>;

  if (files.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#9C9589', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
      No files yet. Start a chat to generate your project.
    </div>
  );

  const getIcon = (f: string) => {
    if (f.endsWith('.ts') || f.endsWith('.tsx')) return '📘';
    if (f.endsWith('.js') || f.endsWith('.jsx')) return '📙';
    if (f.endsWith('.css')) return '🎨';
    if (f.endsWith('.json')) return '📋';
    if (f.endsWith('.md')) return '📝';
    if (f.endsWith('.html')) return '🌐';
    return '📄';
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={handleDownload}
          style={{
            background: '#2D4A2B', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 16px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3A5A37')}
          onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
        >
          ⬇ Download ZIP
        </button>
      </div>
      <div style={{
        background: '#fff', border: '1px solid #EDE8DC',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {files.map((f, i) => (
          <div
            key={f}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderBottom: i < files.length - 1 ? '1px solid #F4F0E8' : 'none',
              fontSize: 13, fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>{getIcon(f)}</span>
            <span style={{ color: '#2A2A2A', flex: 1 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatsTab({ projectId, router }: { projectId: string; router: ReturnType<typeof useRouter> }) {
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
      <div style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 20 }}>
        Open the workspace to start or continue a chat.
      </div>
      <button
        onClick={() => router.push(`/dashboard/project/${projectId}`)}
        style={{
          background: '#2D4A2B', color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 20px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#3A5A37')}
        onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
      >
        Open Workspace →
      </button>
    </div>
  );
}

function SkillsTab() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 13, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 16, lineHeight: 1.6 }}>
        Add context files to help your goblin understand your project better.
      </div>
      <div style={{
        border: '2px dashed #DDD7CC', borderRadius: 10,
        padding: '32px', textAlign: 'center', color: '#9C9589',
        fontFamily: 'DM Sans, sans-serif', fontSize: 13,
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📎</div>
        Drag & drop files here or click to upload
        <br />
        <span style={{ fontSize: 11, opacity: 0.7 }}>Coming in Phase 2</span>
      </div>
    </div>
  );
}

function LinksTab({ project }: { project: Project }) {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* GitHub */}
      <div style={{
        background: '#fff', border: '1px solid #EDE8DC', borderRadius: 10,
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#2A2A2A">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#2A2A2A' }}>GitHub</span>
        </div>
        {project.github_repo ? (
          <a
            href={`https://github.com/${project.github_repo}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#2D4A2B', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            github.com/{project.github_repo} →
          </a>
        ) : (
          <div style={{ fontSize: 12, color: '#9C9589', fontFamily: 'DM Sans, sans-serif' }}>
            Not connected. Push to GitHub from the workspace to connect.
          </div>
        )}
      </div>

      {/* Vercel */}
      <div style={{
        background: '#fff', border: '1px solid #EDE8DC', borderRadius: 10, padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#2A2A2A">
            <path d="M12 2L2 19.5h20L12 2z"/>
          </svg>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#2A2A2A' }}>Vercel</span>
        </div>
        {project.preview_url ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href={project.preview_url}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#2D4A2B', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', wordBreak: 'break-all' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {project.preview_url} →
            </a>
            <a
              href={project.preview_url}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#2D4A2B', color: '#fff', borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 500,
                fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', width: 'fit-content',
              }}
            >
              🌐 Open Website
            </a>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#9C9589', fontFamily: 'DM Sans, sans-serif' }}>
            Not deployed yet. Deploy from Settings → Integrations.
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'storage');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setToken(session.access_token);

      const { data } = await supabase
        .from('projects')
        .select('id,name,description,color,github_repo,preview_url,storage_path,last_active')
        .eq('id', projectId)
        .single();

      if (!data) { router.push('/dashboard'); return; }
      setProject(data as Project);
      setLoading(false);
    };
    load();
  }, [projectId, router]);

  const changeTab = (t: Tab) => {
    setActiveTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url.toString());
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9C9589', fontFamily: 'DM Sans, sans-serif' }}>
      Loading project…
    </div>
  );

  if (!project) return null;

  const dotColor = project.color ?? '#D4A94A';

  return (
    <div style={{ height: '100%', background: '#F7F4ED', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .tab-btn { transition: all 0.15s; }
        .tab-btn:hover:not([data-active="true"]) { color: #2D4A2B !important; background: rgba(45,74,43,0.05) !important; }
      `}</style>

      {/* Project header */}
      <div style={{
        padding: '20px 24px 0',
        borderBottom: '1px solid #DDD7CC',
        background: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: dotColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            👺
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontFamily: 'Fraunces, serif', fontSize: 22,
              color: '#2D4A2B', fontWeight: 700, letterSpacing: '-0.5px',
              marginBottom: 4,
            }}>
              {project.name}
            </h1>
            {project.description && (
              <p style={{ fontSize: 13, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push(`/dashboard/project/${project.id}`)}
            style={{
              background: '#D4A94A', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = '#e8b05a'); (e.currentTarget.style.transform = 'translateY(-1px)'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = '#D4A94A'); (e.currentTarget.style.transform = 'none'); }}
          >
            💬 Open Chat
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TAB_LABELS.map(t => (
            <button
              key={t.id}
              className="tab-btn"
              data-active={activeTab === t.id}
              onClick={() => changeTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: '8px 8px 0 0',
                fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
                cursor: 'pointer',
                background: activeTab === t.id ? '#F7F4ED' : 'transparent',
                color: activeTab === t.id ? '#2D4A2B' : '#9C9589',
                border: activeTab === t.id ? '1px solid #DDD7CC' : '1px solid transparent',
                borderBottom: activeTab === t.id ? '1px solid #F7F4ED' : '1px solid transparent',
                fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: -1,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'storage' && <FilesTab projectId={project.id} token={token} />}
        {activeTab === 'chats'   && <ChatsTab projectId={project.id} router={router} />}
        {activeTab === 'skills'  && <SkillsTab />}
        {activeTab === 'links'   && <LinksTab project={project} />}
      </div>
    </div>
  );
}
