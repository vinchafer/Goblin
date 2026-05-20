'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { NewProjectModal } from '@/components/projects/new-project-modal';
import { Icon } from '@/components/ui/icon';
import { GoblinMark } from '@/components/ui/goblin-mark';

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

const UPDATES = [
  { tag: 'Neu', title: 'BYOK-Streaming gefixt', desc: 'Anthropic, OpenAI und Groq streamen jetzt zuverlässig.', date: 'Mai 2026' },
  { tag: 'Neu', title: 'Claude Sonnet 4.6 verfügbar', desc: 'Neuestes Anthropic-Modell via BYOK.', date: 'Mai 2026' },
  { tag: 'Update', title: 'An-Code-senden auf Mobile', desc: 'Funktioniert auf iOS und Android.', date: 'Apr 2026' },
  { tag: 'Security', title: 'Sicherheit gehärtet', desc: 'CORS, Stream-Cancellation, Prozess-Stabilität verbessert.', date: 'Mai 2026' },
];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'gerade eben';
  if (h < 1) return `vor ${m} Min`;
  if (h < 24) return `vor ${h} Std`;
  if (d < 30) return `vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
  const mo = Math.floor(d / 30);
  return `vor ${mo} ${mo === 1 ? 'Monat' : 'Monaten'}`;
}

function timeOfDayGreeting(name: string | null): string {
  const h = new Date().getHours();
  const prefix = h < 5 ? 'Hallo' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  return name ? `${prefix}, ${name}` : prefix;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showNewProjectModal, setShowNewProjectModal } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.push('/login'); return; }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const [projRes, meRes] = await Promise.all([
        fetch(`${apiBase}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!projRes.ok) throw new Error('Projekte konnten nicht geladen werden');
      setProjects(await projRes.json());

      if (meRes.ok) {
        const me = await meRes.json();
        setDisplayName(me.displayName ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

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
        .gb-project-card {
          background: var(--panel);
          border: 1px solid var(--div);
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
          display: flex; flex-direction: column; gap: 10px;
          min-height: 110px;
        }
        .gb-project-card:hover {
          border-color: var(--moss);
          box-shadow: 0 4px 16px rgba(45,74,43,0.08);
          transform: translateY(-1px);
        }
        .gb-quick-btn {
          background: var(--moss); color: var(--ochre);
          border: none; border-radius: 12px;
          padding: 16px 20px;
          font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          display: inline-flex; align-items: center; gap: 10px;
          transition: background 0.15s, transform 0.15s;
        }
        .gb-quick-btn:hover { background: var(--moss-2); transform: translateY(-1px); }
        .gb-quick-btn.outline {
          background: transparent; color: var(--moss);
          border: 1px solid var(--moss);
        }
        .gb-quick-btn.outline:hover { background: rgba(45,74,43,0.06); }
        .gb-projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
        }
        @media (max-width: 600px) {
          .gb-quick-row { flex-direction: column; align-items: stretch !important; }
          .gb-quick-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* Greeting */}
        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 32, fontWeight: 500,
          color: 'var(--text)', letterSpacing: '-0.5px',
          margin: '0 0 6px',
        }}>
          {timeOfDayGreeting(displayName)}
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--meta)', margin: '0 0 28px',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          Was baust du heute?
        </p>

        {/* Quick actions */}
        <div className="gb-quick-row" style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
          <button className="gb-quick-btn" onClick={() => setShowNewProjectModal(true)}>
            <Icon name="add" size={18} /> Neues Projekt
          </button>
          <button className="gb-quick-btn outline" onClick={() => router.push('/dashboard/chat')}>
            <Icon name="chat" size={18} /> Neuer Chat
          </button>
        </div>

        {/* Projects */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12, fontWeight: 700, color: 'var(--meta)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            margin: '0 0 14px',
          }}>
            Deine Projekte
          </h2>

          {loading && (
            <div className="gb-projects-grid">
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  background: 'var(--panel)', border: '1px solid var(--div)',
                  borderRadius: 14, padding: 16, minHeight: 110,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--div)', marginBottom: 14 }} />
                  <div style={{ height: 14, background: 'var(--div)', borderRadius: 4, width: '60%', marginBottom: 8 }} />
                  <div style={{ height: 11, background: 'var(--div)', borderRadius: 4, width: '40%' }} />
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div style={{
              background: 'rgba(184,92,60,0.06)', border: '1px solid rgba(184,92,60,0.2)',
              borderRadius: 10, padding: 16, fontSize: 13, color: 'var(--danger)',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {error} —{' '}
              <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', color: 'var(--danger)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
                erneut versuchen
              </button>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--div)',
              borderRadius: 14, padding: '48px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            }}>
              <GoblinMark size={48} />
              <h3 style={{
                fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 500,
                color: 'var(--text)', margin: '16px 0 6px', letterSpacing: '-0.2px',
              }}>
                Bau dein erstes Projekt
              </h3>
              <p style={{
                fontSize: 14, color: 'var(--meta)', margin: '0 0 20px',
                fontFamily: 'DM Sans, sans-serif', maxWidth: 360, lineHeight: 1.55,
              }}>
                Sag Goblin was du bauen willst — eine Landing Page, ein REST-Endpoint, eine Aufgabenliste. Goblin schreibt den Code, du deployst.
              </p>
              <button className="gb-quick-btn" onClick={() => setShowNewProjectModal(true)}>
                <Icon name="add" size={18} /> Erstes Projekt
              </button>
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <div className="gb-projects-grid">
              {projects.map((p, i) => {
                const dotColor = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]!;
                return (
                  <div
                    key={p.id}
                    className="gb-project-card"
                    onClick={() => router.push(`/dashboard/project/${p.id}`)}
                    role="link"
                    tabIndex={0}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--meta)' }}>
                        {p.github_repo && (
                          <a
                            href={`https://github.com/${p.github_repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--meta)', display: 'flex' }}
                            title="GitHub"
                          ><Icon name="github" size={14} /></a>
                        )}
                        {p.preview_url && (
                          <a
                            href={p.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--meta)', display: 'flex' }}
                            title="Preview"
                          ><Icon name="externalLink" size={14} /></a>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 600, color: 'var(--text)',
                        fontFamily: 'DM Sans, sans-serif',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: p.description ? 4 : 0,
                      }}>
                        {p.name}
                      </div>
                      {p.description && (
                        <div style={{
                          fontSize: 12, color: 'var(--meta)',
                          fontFamily: 'DM Sans, sans-serif',
                          lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {p.description}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
                      {timeAgo(p.updated_at ?? p.last_active)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Was ist neu */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 12, fontWeight: 700, color: 'var(--meta)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              margin: 0,
            }}>
              Was ist neu
            </h2>
            <a
              href="https://github.com/justgoblin/changelog"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--meta)', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}
            >
              Alle →
            </a>
          </div>

          <div style={{
            background: 'var(--panel)', border: '1px solid var(--div)',
            borderRadius: 14, padding: '4px 0', overflow: 'hidden',
          }}>
            {UPDATES.map((u, i) => {
              const isLast = i === UPDATES.length - 1;
              const tagColor = u.tag === 'Neu' ? 'var(--moss)'
                : u.tag === 'Security' ? 'var(--danger)'
                : 'var(--ochre-dark, #C9933A)';
              const tagBg = u.tag === 'Neu' ? 'rgba(45,74,43,0.08)'
                : u.tag === 'Security' ? 'rgba(184,92,60,0.08)'
                : 'rgba(212,169,74,0.12)';
              return (
                <div key={u.title} style={{
                  padding: '14px 18px',
                  borderBottom: isLast ? 'none' : '1px solid var(--div)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: tagColor,
                    background: tagBg, padding: '2px 8px',
                    borderRadius: 4, fontFamily: 'DM Sans, sans-serif',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    flexShrink: 0, marginTop: 2,
                  }}>{u.tag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2, fontFamily: 'DM Sans, sans-serif' }}>
                      {u.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>
                      {u.desc}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', flexShrink: 0, marginTop: 2 }}>
                    {u.date}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
