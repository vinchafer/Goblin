'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { NewProjectModal } from '@/components/projects/new-project-modal';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  github_repo?: string | null;
  preview_url?: string | null;
  last_active?: string;
  updated_at?: string;
}

const PROJECT_COLORS = [
  'var(--ochre)', 'var(--success)', '#7A4A8A',
  '#3A6B8A', 'var(--danger)', '#4A7A7A', 'var(--moss)',
];

const STARTER_CARDS = [
  { icon: '🚀', label: 'Landing Page', prompt: 'Build a modern landing page with a hero section, features list, pricing table, and contact form. Use a clean, professional design.' },
  { icon: '📊', label: 'SaaS Dashboard', prompt: 'Create a SaaS dashboard with a sidebar navigation, stats cards, a data table, and charts. Include light/dark mode support.' },
  { icon: '📱', label: 'Mobile Web App', prompt: 'Build a mobile-first web app with bottom navigation, swipe gestures support, and a clean card-based layout.' },
  { icon: '🔌', label: 'REST API', prompt: 'Create a REST API with TypeScript and Hono. Include CRUD endpoints, input validation with Zod, and JWT authentication.' },
  { icon: '📨', label: 'Newsletter Tool', prompt: 'Build a newsletter sign-up tool with a beautiful subscription form, email list management, and a simple template editor.' },
  { icon: '🧩', label: 'Chrome Extension', prompt: 'Create a Chrome extension with a popup UI, background service worker, and content script. Include a settings page.' },
];

const UPDATES = [
  { tag: 'New', title: 'BYOK Streaming fixed', desc: 'Anthropic, OpenAI, and Groq keys now stream reliably with full tier routing.', date: 'May 2026' },
  { tag: 'New', title: 'Claude Sonnet 4.6 available', desc: 'Latest Anthropic model now available via BYOK.', date: 'May 2026' },
  { tag: 'Update', title: 'Send to Code on mobile', desc: 'Works on iOS and Android browsers.', date: 'Apr 2026' },
  { tag: 'Security', title: 'Security hardened', desc: 'CORS hardened, process stability improved, stream cancellation propagated.', date: 'May 2026' },
];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'just now';
  if (h < 1) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

function GitHubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function StarterCard({ icon, label, prompt, onClick }: { icon: string; label: string; prompt: string; onClick: (prompt: string) => void }) {
  return (
    <button
      onClick={() => onClick(prompt)}
      style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 14px',
        textAlign: 'left', cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 6,
        fontFamily: 'DM Sans, sans-serif',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--moss)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(45,74,43,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--div)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { showNewProjectModal, setShowNewProjectModal } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.push('/login'); return; }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load projects');
      setProjects(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Refresh when modal closes (covers create-then-back-navigate)
  const prevModalOpen = useRef(false);
  useEffect(() => {
    if (prevModalOpen.current && !showNewProjectModal) {
      loadProjects();
    }
    prevModalOpen.current = showNewProjectModal;
  }, [showNewProjectModal, loadProjects]);

  return (
    <div style={{ height: '100%', background: 'var(--cream)', overflowY: 'auto' }}>
      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        .project-row { transition: background 0.1s; cursor: pointer; }
        .project-row:hover { background: rgba(0,0,0,0.02); }
        @media (max-width: 900px) {
          .dash-grid { flex-direction: column !important; }
          .dash-right { width: 100% !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div className="dash-grid" style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>

          {/* LEFT — Projects */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 24,
            }}>
              <h1 style={{
                fontFamily: 'Fraunces, serif', fontSize: 22,
                color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.5px',
              }}>
                Projects
              </h1>
              <button
                onClick={() => setShowNewProjectModal(true)}
                style={{
                  background: 'var(--moss)', color: '#fff',
                  border: 'none',
                  borderRadius: 8, padding: '8px 14px',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>New</span>
              </button>
            </div>

            {/* Skeleton rows */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--div)', animation: 'pulse 1.5s ease-in-out infinite' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--div)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 14, background: 'var(--div)', borderRadius: 4, width: '40%', marginBottom: 6 }} />
                      <div style={{ height: 11, background: 'var(--div)', borderRadius: 4, width: '65%' }} />
                    </div>
                    <div style={{ height: 11, background: 'var(--div)', borderRadius: 4, width: 28 }} />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{
                background: 'rgba(184,92,60,0.06)', border: '1px solid rgba(184,92,60,0.2)',
                borderRadius: 8, padding: '16px', fontSize: 13, color: 'var(--danger)',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {error} —{' '}
                <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', color: 'var(--danger)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
                  retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && projects.length === 0 && (
              <div style={{ paddingTop: 48 }}>
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{
                    fontFamily: 'Fraunces, serif', fontSize: 24,
                    color: 'var(--moss)', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.4px',
                  }}>
                    What do you want to build?
                  </h2>
                  <p style={{
                    fontSize: 14, color: 'var(--meta)', marginBottom: 0,
                    fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6,
                    maxWidth: 480,
                  }}>
                    Describe your idea and Goblin will build it — or pick a starting point below.
                  </p>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 12, marginBottom: 28,
                }}>
                  {STARTER_CARDS.map(c => (
                    <StarterCard
                      key={c.label}
                      icon={c.icon}
                      label={c.label}
                      prompt={c.prompt}
                      onClick={(prompt) => {
                        setShowNewProjectModal(true);
                        sessionStorage.setItem('goblin_prefill_prompt', prompt);
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setShowNewProjectModal(true)}
                  style={{
                    background: 'var(--moss)', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '11px 22px',
                    fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                >
                  Start with a blank project
                </button>
              </div>
            )}

            {/* Project list */}
            {!loading && !error && projects.length > 0 && (
              <div style={{ borderTop: '1px solid var(--div)' }}>
                {projects.map((p, i) => {
                  const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
                  return (
                    <div
                      key={p.id}
                      className="project-row"
                      onClick={() => router.push(`/dashboard/project/${p.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 8px',
                        borderBottom: '1px solid var(--div)',
                        borderRadius: 6, margin: '0 -8px',
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: dotColor, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 500,
                          color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: p.description ? 2 : 0,
                          fontFamily: 'DM Sans, sans-serif',
                        }}>
                          {p.name}
                        </div>
                        {p.description && (
                          <div style={{
                            fontSize: 12, color: 'var(--meta)',
                            fontFamily: 'DM Sans, sans-serif',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {p.description}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {p.github_repo && (
                          <a
                            href={`https://github.com/${p.github_repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--meta)', display: 'flex' }}
                            title="GitHub"
                          >
                            <GitHubIcon />
                          </a>
                        )}
                        {p.preview_url && (
                          <a
                            href={p.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--meta)', display: 'flex' }}
                            title="Preview"
                          >
                            <ExternalIcon />
                          </a>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', minWidth: 28, textAlign: 'right' }}>
                          {timeAgo(p.updated_at ?? p.last_active)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Changelog + Community */}
          <div className="dash-right" style={{ width: 260, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <h2 style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700,
                color: 'var(--meta)', letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Changelog
              </h2>
              <a
                href="https://github.com/justgoblin/changelog"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'var(--meta)', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--moss)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
              >
                All →
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              {UPDATES.map((u) => {
                const tagColor = u.tag === 'New' ? 'var(--moss)'
                  : u.tag === 'Security' ? 'var(--danger)'
                  : 'var(--ochre-dark, #C9933A)';
                const tagBg = u.tag === 'New' ? 'rgba(45,74,43,0.08)'
                  : u.tag === 'Security' ? 'rgba(184,92,60,0.08)'
                  : 'rgba(212,169,74,0.12)';
                return (
                  <div key={u.title} style={{ position: 'relative', paddingLeft: 16 }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: 0, top: 6,
                      width: 7, height: 7, borderRadius: '50%',
                      background: tagColor, opacity: 0.6,
                    }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: tagColor,
                        background: tagBg, padding: '1px 6px',
                        borderRadius: 3, fontFamily: 'DM Sans, sans-serif',
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>{u.tag}</span>
                      <span style={{ fontSize: 10, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>{u.date}</span>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text)',
                      marginBottom: 3, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.35,
                    }}>
                      {u.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--meta)', lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>
                      {u.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Community card */}
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
                Join the community
              </div>
              <div style={{ fontSize: 12, color: 'var(--meta)', marginBottom: 12, lineHeight: 1.5 }}>
                Get help, share builds, and shape what Goblin becomes.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href="https://discord.gg/goblin"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, fontSize: 12, color: 'var(--moss)',
                    background: 'var(--subtle)', border: '1px solid var(--border)',
                    borderRadius: 7, padding: '6px 10px', textAlign: 'center',
                    fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', fontWeight: 500,
                  }}
                >Discord</a>
                <a
                  href="https://twitter.com/justgoblin"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, fontSize: 12, color: 'var(--moss)',
                    background: 'var(--subtle)', border: '1px solid var(--border)',
                    borderRadius: 7, padding: '6px 10px', textAlign: 'center',
                    fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', fontWeight: 500,
                  }}
                >X / Twitter</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
