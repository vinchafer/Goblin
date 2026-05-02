'use client';

import { useEffect, useState } from 'react';
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
  '#D4A94A', '#4A7C3B', '#7A4A8A',
  '#3A6B8A', '#B85C3C', '#4A7A7A', '#2D4A2B',
];

const UPDATES = [
  { emoji: '🆕', title: 'Model Hub: Claude Sonnet 4.6', desc: 'Latest Anthropic model now available via BYOK. Best for coding tasks.', date: 'Apr 2026' },
  { emoji: '📱', title: 'Send to Code on mobile', desc: 'The [Send to Code] button now works perfectly on iOS and Android browsers.', date: 'Apr 2026' },
  { emoji: '🔒', title: 'Security hardened', desc: 'Atomic usage limits, XSS protection, and webhook validation upgraded.', date: 'Apr 2026' },
  { emoji: '🎨', title: 'UI overhaul', desc: 'Dashboard, settings, and chat all got a fresh coat of paint.', date: 'Mar 2026' },
];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'just now';
  if (h < 1) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
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

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--panel)', borderRadius: 12,
      border: '1px solid var(--div)', padding: '18px 18px 16px',
      minHeight: 120,
      animation: 'pulse 1.5s ease-in-out infinite',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--div)', marginTop: 4, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 18, background: 'var(--div)', borderRadius: 4, marginBottom: 8, width: '65%' }} />
          <div style={{ height: 13, background: 'var(--div)', borderRadius: 4, marginBottom: 4, width: '90%' }} />
          <div style={{ height: 13, background: 'var(--div)', borderRadius: 4, width: '70%' }} />
        </div>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', gap: 6 }}>
        <div style={{ height: 11, width: 48, background: 'var(--div)', borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { showNewProjectModal, setShowNewProjectModal } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
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
    };
    load();
  }, [router]);

  return (
    <div style={{ height: '100%', background: 'var(--cream)', overflowY: 'auto' }}>
      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
        .project-card { transition: box-shadow 0.15s, transform 0.15s; cursor: pointer; background: var(--panel); border-color: var(--div) !important; }
        .project-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
        @media (max-width: 900px) {
          .dash-grid { flex-direction: column !important; }
          .dash-projects { width: 100% !important; }
          .dash-right { width: 100% !important; }
          .proj-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .proj-grid { grid-template-columns: 1fr !important; }
          .whats-new-list {
            flex-direction: row !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 4px;
          }
          .whats-new-list::-webkit-scrollbar { display: none; }
          .whats-new-card { flex-shrink: 0 !important; width: 240px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Two-column layout */}
        <div className="dash-grid" style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          {/* LEFT — Projects */}
          <div className="dash-projects" style={{ flex: '1 1 60%', minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 20,
            }}>
              <h1 style={{
                fontFamily: 'Fraunces, serif', fontSize: 26,
                color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.8px',
              }}>
                Your Projects
              </h1>
              {projects.length > 0 && (
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  style={{
                    background: 'var(--moss)', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
                >
                  <span style={{ fontSize: 15 }}>＋</span> New
                </button>
              )}
            </div>

            {/* Skeleton */}
            {loading && (
              <div className="proj-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FCA5A5',
                borderRadius: 12, padding: '20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                <div style={{ fontSize: 14, color: '#991B1B', fontFamily: 'DM Sans, sans-serif' }}>{error}</div>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    marginTop: 12, background: '#991B1B', color: '#fff',
                    border: 'none', borderRadius: 7, padding: '7px 16px',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && projects.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '64px 24px',
                animation: 'fadeIn 0.4s ease',
              }}>
                <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>👺</div>
                <h2 style={{
                  fontFamily: 'Fraunces, serif', fontSize: 24,
                  color: 'var(--moss)', fontWeight: 700, marginBottom: 10,
                }}>
                  Your goblin is ready.
                </h2>
                <p style={{
                  fontSize: 15, color: 'var(--meta)', marginBottom: 28,
                  fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, maxWidth: 340, margin: '0 auto 28px',
                }}>
                  Describe what you want to build. Your goblin will generate the code, push to GitHub, and ship it.
                </p>
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  style={{
                    background: '#D4A94A', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '13px 28px',
                    fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.background = '#e8b05a'); (e.currentTarget.style.transform = 'translateY(-1px)'); }}
                  onMouseLeave={e => { (e.currentTarget.style.background = '#D4A94A'); (e.currentTarget.style.transform = 'none'); }}
                >
                  ＋ Build your first project
                </button>
              </div>
            )}

            {/* Project grid */}
            {!loading && !error && projects.length > 0 && (
              <div className="proj-grid" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                animation: 'fadeIn 0.3s ease',
              }}>
                {projects.map((p, i) => {
                  const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
                  return (
                    <div
                      key={p.id}
                      className="project-card"
                      onClick={() => router.push(`/dashboard/project/${p.id}`)}
                      style={{
                        background: 'var(--panel)', borderRadius: 12,
                        border: '1px solid var(--div)', padding: '18px 18px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: dotColor, marginTop: 4, flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'Fraunces, serif', fontSize: 16,
                            color: 'var(--moss)', fontWeight: 700,
                            letterSpacing: '-0.3px', marginBottom: 4,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {p.name}
                          </div>
                          {p.description && (
                            <div style={{
                              fontSize: 12, color: 'var(--meta)',
                              fontFamily: 'DM Sans, sans-serif',
                              lineHeight: 1.5,
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer row */}
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        gap: 8, marginTop: 6,
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'DM Sans, sans-serif' }}>
                          {timeAgo(p.updated_at ?? p.last_active)}
                        </span>
                        <div style={{ flex: 1 }} />
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
                      </div>
                    </div>
                  );
                })}

                {/* New Project card — with template quick-start */}
                <div
                  style={{
                    background: 'transparent',
                    borderRadius: 12,
                    border: '1.5px dashed var(--border)',
                    padding: '14px',
                    display: 'flex', flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="project-card"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 4px', borderRadius: 6, width: '100%',
                    }}
                  >
                    <span style={{ fontSize: 18, opacity: 0.4 }}>＋</span>
                    <span style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'DM Sans, sans-serif' }}>Blank project</span>
                  </button>
                  <div style={{ borderTop: '1px solid var(--div)', paddingTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Quick start</div>
                    {[
                      { icon: '🚀', label: 'SaaS Starter', key: 'saas-starter' },
                      { icon: '🌟', label: 'Landing Page', key: 'landing-pro' },
                      { icon: '🛠️', label: 'AI Chat App', key: 'ai-chat' },
                    ].map(t => (
                      <button
                        key={t.key}
                        onClick={() => setShowNewProjectModal(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', width: '100%' }}
                      >
                        <span style={{ fontSize: 12 }}>{t.icon}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif' }}>{t.label}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setShowNewProjectModal(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ochre)', fontFamily: 'DM Sans, sans-serif', padding: '6px 0 0', display: 'block', fontWeight: 600 }}>
                      Browse all templates →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — What's New */}
          <div className="dash-right" style={{ width: 300, flexShrink: 0 }}>
            <h2 style={{
              fontFamily: 'Fraunces, serif', fontSize: 20,
              color: 'var(--moss)', fontWeight: 700,
              letterSpacing: '-0.5px', marginBottom: 16,
            }}>
              What&apos;s New
            </h2>

            <div className="whats-new-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPDATES.map((u) => (
                <div
                  key={u.title}
                  className="whats-new-card"
                  style={{
                    background: 'var(--panel)', borderRadius: 10,
                    border: '1px solid var(--div)', padding: '14px 14px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{u.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                        fontWeight: 600, color: 'var(--text)', marginBottom: 3,
                        lineHeight: 1.3,
                      }}>
                        {u.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--meta)', lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>
                        {u.desc}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 5, fontFamily: 'DM Sans, sans-serif' }}>
                        {u.date}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Community links */}
            <div style={{
              marginTop: 16, background: 'var(--moss)',
              borderRadius: 10, padding: '16px',
            }}>
              <div style={{
                fontFamily: 'Fraunces, serif', fontSize: 14,
                color: '#D4A94A', fontWeight: 700, marginBottom: 6,
              }}>
                Join the community
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'DM Sans, sans-serif', marginBottom: 12, lineHeight: 1.5 }}>
                Follow the build-in-public journey, get early access, share feedback.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <a
                  href="https://discord.gg/goblin"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    color: 'rgba(255,255,255,0.85)', fontSize: 12,
                    fontFamily: 'DM Sans, sans-serif', textDecoration: 'none',
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                >
                  <span style={{ fontSize: 14 }}>💬</span> Discord community →
                </a>
                <a
                  href="https://twitter.com/justgoblin"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    color: 'rgba(255,255,255,0.85)', fontSize: 12,
                    fontFamily: 'DM Sans, sans-serif', textDecoration: 'none',
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                >
                  <span style={{ fontSize: 14 }}>𝕏</span> Build in public →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
