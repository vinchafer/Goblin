'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { NewProjectModal } from '@/components/projects/new-project-modal';

const FEATURES = [
  {
    icon: '💬',
    title: 'Chat with AI',
    desc: 'Describe what you want to build in plain English. Your goblin understands.',
  },
  {
    icon: '→',
    title: 'Send to Code',
    desc: 'One tap sends AI output directly to your editor. No clipboard, no switching tabs.',
  },
  {
    icon: '🐙',
    title: 'Push to GitHub',
    desc: 'Deploy your project to GitHub — and from there to Vercel — in one click.',
  },
];

interface Project {
  id: string;
  name: string;
  color?: string;
  updated_at?: string;
  last_active?: string;
}

export default function DashboardPage() {
  const supabase = createClient();
  const { showNewProjectModal, setShowNewProjectModal } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${apiBase}/api/projects`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to fetch projects');
        }

        const projectsData = await response.json();
        setProjects(projectsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '48px 24px',
      textAlign: 'center', background: 'var(--cream)',
    }}>
      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ fontSize: 72, marginBottom: 24, lineHeight: 1, opacity: 0.3 }}>👺</div>
          <div style={{ height: 40, background: 'var(--border)', borderRadius: 8, marginBottom: 12, opacity: 0.5 }}></div>
          <div style={{ height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 36, maxWidth: 380, margin: '0 auto 36px', opacity: 0.5 }}></div>
          <div style={{ height: 48, background: 'var(--border)', borderRadius: 10, marginBottom: 64, opacity: 0.5 }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 720, width: '100%' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px', opacity: 0.5 }}>
                <div style={{ height: 28, background: 'var(--border)', borderRadius: 4, marginBottom: 10 }}></div>
                <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, marginBottom: 6 }}></div>
                <div style={{ height: 13, background: 'var(--border)', borderRadius: 4 }}></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: 72, marginBottom: 24, lineHeight: 1 }}>⚠️</div>
          <h1 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 5vw, 40px)',
            color: 'var(--moss)', fontWeight: 700,
            marginBottom: 12, letterSpacing: '-1px', lineHeight: 1.1,
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--meta)',
            maxWidth: 380, lineHeight: 1.65,
            marginBottom: 36, fontWeight: 300,
          }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--moss)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '14px 28px',
              fontSize: 15, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              minHeight: 48,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >
            Retry
          </button>
        </div>
      )}

      {/* Normal state */}
      {!loading && !error && (
        <>
          {/* Goblin emoji */}
          <div style={{ fontSize: 72, marginBottom: 24, lineHeight: 1 }}>👺</div>

          <h1 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 5vw, 40px)',
            color: 'var(--moss)', fontWeight: 700,
            marginBottom: 12, letterSpacing: '-1px', lineHeight: 1.1,
          }}>
            Welcome to Goblin.
          </h1>

          <p style={{
            fontSize: 16, color: 'var(--meta)',
            maxWidth: 380, lineHeight: 1.65,
            marginBottom: 36, fontWeight: 300,
          }}>
            Create your first project to start building.
            Your goblin is ready.
          </p>

          <button
            onClick={() => setShowNewProjectModal(true)}
            style={{
              background: 'var(--moss)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '14px 28px',
              fontSize: 15, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              minHeight: 48,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
          >
            ＋ Create your first project →
          </button>

          {/* Feature cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16, maxWidth: 720,
            marginTop: 64, width: '100%',
          }}>
            {FEATURES.map(f => (
              <div
                key={f.title}
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 12, padding: '20px 20px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1 }}>{f.icon}</div>
                <div style={{
                  fontFamily: 'Fraunces, serif', fontSize: 16,
                  color: 'var(--moss)', fontWeight: 700, marginBottom: 6,
                }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.55, fontWeight: 300 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
