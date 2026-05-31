import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

interface DeployRow {
  id: string;
  commit_message?: string | null;
  status?: string | null;
  model_used?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

function timeAgoDe(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'gerade eben';
  if (h < 1) return `vor ${m} min`;
  if (h < 24) return `vor ${h} std`;
  if (d < 30) return `vor ${d} ${d === 1 ? 'tag' : 'tagen'}`;
  const mo = Math.floor(d / 30);
  return `vor ${mo} ${mo === 1 ? 'monat' : 'monaten'}`;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, description, preview_url, github_repo, status, created_at, last_active')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: {
      id: string; name: string; description: string | null;
      preview_url: string | null; github_repo: string | null;
      status: string | null; created_at: string | null; last_active: string | null;
    } | null };

  if (!project) notFound();

  // Deploys + recent activity in parallel. Best-effort; both can be empty.
  const [deploysRes, msgsRes] = await Promise.all([
    supabase
      .from('build_runs')
      .select('id, commit_message, status, model_used, duration_ms, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('chat_messages')
      .select('id, role, content, model_used, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const deploys: DeployRow[] = (deploysRes.data as DeployRow[] | null) ?? [];
  const messages = (msgsRes.data as Array<{ id: string; role: string; content: string; model_used: string | null; created_at: string }> | null) ?? [];

  const status = (project.status ?? 'idle').toUpperCase();

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>

        <header style={{ padding: '36px 32px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div className="gobl-eyebrow" style={{ marginBottom: 12 }}>
                <span className="tick" />
                <span className="num">PROJEKT · {project.name.toUpperCase()}</span>
                {status}
              </div>
              <h1 style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontWeight: 600, fontSize: 'clamp(28px, 3.4vw, 44px)',
                letterSpacing: '-0.032em', lineHeight: 1.08,
                color: 'var(--ink-1)', margin: '0 0 10px',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', overflowWrap: 'anywhere', maxWidth: '18ch',
              } as React.CSSProperties} title={project.name}>
                {project.name}
              </h1>
              {project.description && (
                <p style={{
                  fontSize: 15.5, color: 'var(--ink-2)', maxWidth: '60ch',
                  lineHeight: 1.5, margin: 0,
                }}>
                  {project.description.split('\n')[0]}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/dashboard/project/${id}/work?tab=chat`} className="gobl-btn primary lg">
                Chat öffnen →
              </Link>
              <Link href={`/dashboard/project/${id}/work?tab=code`} className="gobl-btn secondary lg">
                Code öffnen
              </Link>
              {/* Secrets — de-emphasised per decision: ghost, not primary. */}
              <Link href={`/dashboard/project/${id}/secrets`} className="gobl-btn ghost lg" title="Verschlüsselte Umgebungsvariablen">
                Secrets
              </Link>
            </div>
          </div>
        </header>

        <div style={{ padding: '28px 32px 80px' }}>
          {/* Honest one-liner replacing the removed spend / build-env blocks. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginBottom: 24, padding: '12px 16px',
            background: 'var(--d-surface-elev)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
              letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase',
            }}>
              {deploys.length} DEPLOY{deploys.length === 1 ? '' : 'S'} · ZULETZT AKTIV {project.last_active ? timeAgoDe(project.last_active) : '—'}
            </span>
            <Link href="/dashboard/usage" style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              color: 'var(--ink-2)', textDecoration: 'none',
            }}>
              Verbrauch ansehen →
            </Link>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: 24,
          }}>
            <div className="gobl-panel" style={{ overflow: 'hidden', alignSelf: 'start' }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid var(--line)',
              }}>
                <h2 style={{
                  fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  fontWeight: 600, fontSize: 15, letterSpacing: '-0.014em',
                  color: 'var(--ink-1)', margin: 0,
                }}>
                  Letzte Deploys
                </h2>
              </div>
              {deploys.length === 0 ? (
                <div style={{ padding: '24px 18px', fontSize: 13.5, color: 'var(--ink-3)' }}>
                  Noch keine Deploys. Bau etwas und drücke „Deploy“.
                </div>
              ) : (
                deploys.map((d, i) => {
                  const dotColor = d.status === 'failed' ? 'var(--danger)'
                    : d.status === 'building' || d.status === 'pending' ? 'var(--gold)'
                    : '#6db97b';
                  return (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 18px',
                      borderBottom: i === deploys.length - 1 ? 'none' : '1px solid var(--line)',
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: dotColor, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                          fontWeight: 600, fontSize: 13.5, color: 'var(--ink-1)', marginBottom: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {d.commit_message || 'Deploy'}
                        </div>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                          color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                          {(d.model_used || '—').toUpperCase()} · {(d.status || 'OK').toUpperCase()}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                        color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>
                        {timeAgoDe(d.created_at)} {d.duration_ms ? `· ${Math.round(d.duration_ms / 1000)}s` : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="gobl-panel" style={{ overflow: 'hidden' }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <h2 style={{
                    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                    fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', margin: 0,
                  }}>
                    Aktivität
                  </h2>
                  <Link href={`/dashboard/project/${id}/work?tab=chat`} style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--ink-3)', textDecoration: 'none',
                  }}>
                    CHAT ÖFFNEN →
                  </Link>
                </div>
                {messages.length === 0 ? (
                  <div style={{ padding: '20px 18px', fontSize: 13.5, color: 'var(--ink-3)' }}>
                    Noch nichts passiert. Stelle Goblin eine Frage im Chat.
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={m.id} style={{
                      display: 'flex', gap: 12, padding: '12px 18px',
                      borderBottom: i === messages.length - 1 ? 'none' : '1px solid var(--line)',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: m.role === 'user' ? 'var(--ink-1)' : 'var(--green)',
                        color: m.role === 'user' ? 'var(--bone)' : 'var(--gold)',
                        fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                        fontWeight: 700, fontSize: 10,
                      }}>
                        {m.role === 'user' ? 'D' : 'G'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.45,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          <b>{m.role === 'user' ? 'Du' : 'Goblin'}:</b> {m.content.replace(/```[\s\S]*?```/g, '[Code-Block]').slice(0, 200)}
                        </div>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                          color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.04em',
                        }}>
                          {timeAgoDe(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="gobl-panel" style={{ overflow: 'hidden' }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <h2 style={{
                    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                    fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', margin: 0,
                  }}>
                    Dateien
                  </h2>
                  <Link href={`/dashboard/project/${id}/work?tab=code`} style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--ink-3)', textDecoration: 'none',
                  }}>
                    EDITOR ÖFFNEN →
                  </Link>
                </div>
                <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Vollständiger Dateibaum lebt im Editor. Tippe oben rechts „Editor öffnen“.
                </div>
              </div>

              <div className="gobl-panel" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                    fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', margin: 0,
                  }}>
                    URLs
                  </h2>
                </div>
                <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {project.preview_url ? (
                    <a href={project.preview_url} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'var(--ok-soft)', border: '1px solid rgba(47,106,71,.30)',
                      color: 'var(--ok)', borderRadius: 999, padding: '7px 14px',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
                      textDecoration: 'none', width: 'fit-content',
                    }}>
                      🌐 {project.preview_url.replace(/^https?:\/\//, '')} · LIVE
                    </a>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                      Noch nicht deployed.
                    </span>
                  )}
                  {project.github_repo && (
                    <a href={`https://github.com/${project.github_repo}`} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'var(--d-surface-elev)', border: '1px solid var(--line)',
                      color: 'var(--ink-1)', borderRadius: 999, padding: '7px 14px',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
                      textDecoration: 'none', width: 'fit-content',
                    }}>
                      ⌨ {project.github_repo}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
