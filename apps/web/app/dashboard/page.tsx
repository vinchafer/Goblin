'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { NewProjectModal } from '@/components/projects/new-project-modal';
import { ChatInput, useChatModel } from '@/components/chat/ChatInput';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  github_repo?: string | null;
  preview_url?: string | null;
  status?: string | null;
  last_active?: string;
  updated_at?: string;
}

// Color rotation for project dots when none stored.
const DOT_COLORS = ['var(--gold)', '#6db97b', '#7A4A8A', '#3A6B8A', '#a04230', '#4A7A7A'];

// Plain-language updates (decision: rewrite quick-prompts + updates in user words).
const UPDATES = [
  { tag: 'NEU', tone: 'gold', title: 'Claude Sonnet 4.6 verfügbar', desc: 'Goblin nutzt dein eigenes Anthropic-Konto automatisch.', date: 'MAI 22' },
  { tag: 'NEU', tone: 'gold', title: 'BYOK-Streaming stabilisiert', desc: 'Anthropic, OpenAI und Groq streamen wieder ohne Abbrüche.', date: 'MAI 20' },
  { tag: 'UPDATE', tone: 'plain', title: 'Send to Code auf dem Handy', desc: 'Code aus dem Chat in den Editor schieben — funktioniert auch unterwegs.', date: 'APR 14' },
  { tag: 'SICHERHEIT', tone: 'warn', title: 'CORS und Stream-Abbrüche gehärtet', desc: 'Stabilität und Abbruch-Verhalten in allen Routen verbessert.', date: 'APR 08' },
] as const;

// Quick prompts — plain user language, not dev jargon.
const QUICK_PROMPTS = [
  'Eine Landingpage mit Anmeldeformular',
  'Eine Aufgabenliste, die meine Einträge merkt',
  'Eine Seite, auf der Leute Termine buchen können',
  'Magic-Link-Login für meine Next.js-App',
];

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'GERADE EBEN';
  if (h < 1) return `VOR ${m} MIN`;
  if (h < 24) return `VOR ${h} STD`;
  if (d < 30) return `VOR ${d} ${d === 1 ? 'TAG' : 'TAGEN'}`;
  const mo = Math.floor(d / 30);
  return `VOR ${mo} ${mo === 1 ? 'MONAT' : 'MONATEN'}`;
}

function statusLabel(s?: string | null): { label: string; color: string } {
  switch ((s ?? 'idle').toLowerCase()) {
    case 'shipping': return { label: 'SHIPPING', color: 'var(--gold)' };
    case 'live':     return { label: 'LIVE', color: '#6db97b' };
    case 'draft':    return { label: 'DRAFT', color: '#7A4A8A' };
    case 'archived': return { label: 'ARCHIVIERT', color: '#3A6B8A' };
    default:         return { label: 'AKTIV', color: 'var(--gold)' };
  }
}

// Casual variants sprinkled in ~30% of loads so the greeting never reads like
// a robotic elevator announcement. Time-of-day picks the default base.
const GREETING_CASUAL = ['Hi', 'Servus', 'Schön dich zu sehen', 'Bereit zum Bauen', 'Aloha'];

function buildGreeting(firstName: string): string {
  const h = new Date().getHours();
  const base =
    h < 5  ? 'Hallo' :
    h < 11 ? 'Guten Morgen' :
    h < 17 ? 'Hallo' :
    h < 23 ? 'Guten Abend' : 'Hallo';
  const word = Math.random() < 0.3
    ? GREETING_CASUAL[Math.floor(Math.random() * GREETING_CASUAL.length)]!
    : base;
  const suffix = word === 'Bereit zum Bauen' ? '?' : '';
  return `${word}, ${firstName}${suffix}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showNewProjectModal, setShowNewProjectModal } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Hero composer is the real shared ChatInput. We keep only the model state
  // and a "prefill" channel for the quick-prompt chips → ChatInput.
  const { selectedModel, setSelectedModel } = useChatModel();
  const [prefill, setPrefill] = useState('');

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
    if (prevModalOpen.current && !showNewProjectModal) loadProjects();
    prevModalOpen.current = showNewProjectModal;
  }, [showNewProjectModal, loadProjects]);

  // Send composer text → create chat session + jump to it with the prompt prefilled.
  // Server creates session, then we navigate; the chat session page picks up the
  // sessionStorage seed (single-use, cleared on read).
  const sendComposer = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.push('/login'); return; }
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/chat-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const created = await res.json() as { id: string };
      try { sessionStorage.setItem(`goblin:seed:${created.id}`, trimmed); } catch { /* ignore */ }
      router.push(`/dashboard/chat/${created.id}`);
    } catch { /* network error → leave user on the page, do not crash */ }
  }, [router]);

  const activeCount = projects.filter(p => (p.status ?? 'idle') !== 'archived').length;

  // First name only, comma, name last — "Guten Morgen, Vincent" (not the old
  // "Vincent Hafner Guten Morgen"). Computed once per name resolution so it
  // stays stable across re-renders within a session.
  const firstName = (displayName ?? 'Du').split(' ')[0]!;
  const greeting = useMemo(() => buildGreeting(firstName), [firstName]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
      )}

      <div className="gobl-dash-home" style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 32px 80px' }}>
        <style>{`
          .gobl-proj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
          .gobl-proj-list { display: none; }
          @media (max-width: 480px) {
            .gobl-dash-home { padding: 20px 16px 64px !important; }
            .gobl-proj-grid { display: none; }
            .gobl-proj-list { display: block; }
            .gobl-hero { padding: 18px 16px 16px !important; }
            .gobl-hero-title { margin-bottom: 14px !important; }
          }
        `}</style>

        {/* Composer head (Variant B from mockup — dark card, prominent prompt entry). */}
        <section className="gobl-hero" style={{
          background: 'var(--ink-deep)', color: 'var(--bone)',
          borderRadius: 'var(--radius-lg)', padding: '28px 28px 22px',
          marginBottom: 36, border: '1px solid rgba(244,236,216,.12)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div className="gobl-eyebrow" style={{ color: 'rgba(244,236,216,.62)', marginBottom: 14 }}>
            <span className="tick" />
            <span style={{ color: 'var(--bone)', fontWeight: 600 }}>{greeting}</span>
          </div>
          <h1 className="gobl-hero-title" style={{
            fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
            fontWeight: 600, fontSize: 'var(--t-h1-fs)',
            letterSpacing: 'var(--t-h1-ls)', lineHeight: 'var(--t-h1-lh)',
            color: 'var(--bone)', marginBottom: 18,
          }}>
            Sag Goblin, was du <span className="gobl-serif">bauen willst.</span>
          </h1>

          {/* Real shared ChatInput in hero arrangement — same component as
              screens 05/06, configured via variant="hero". Submitting starts
              a new chat (create session → seed prompt → navigate). */}
          <ChatInput
            variant="hero"
            placeholder="Eine Landingpage mit Stripe-Bezahlung in Next.js…"
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            prefill={prefill}
            onSubmit={(message) => sendComposer(message)}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {QUICK_PROMPTS.map(q => (
              <button
                key={q}
                onClick={() => setPrefill(p => (p === q ? q + ' ' : q))}
                style={{
                  background: 'transparent', color: 'rgba(244,236,216,.62)',
                  border: '1px solid rgba(244,236,216,.14)', borderRadius: 999,
                  padding: '6px 12px', fontSize: 'var(--t-caption-fs)', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--bone)'; e.currentTarget.style.borderColor = 'rgba(244,236,216,.30)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(244,236,216,.62)'; e.currentTarget.style.borderColor = 'rgba(244,236,216,.14)'; }}
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* Projects (Variant A — cards). Stats row REMOVED per decision. */}
        <section style={{ marginBottom: 48 }}>
          <div className="gobl-section-title" style={{ marginTop: 0 }}>
            <h2>Deine Projekte</h2>
            <span className="label">{loading ? '…' : `${activeCount} AKTIV`}</span>
          </div>

          {loading && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12,
            }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="gobl-panel" style={{
                  padding: 14, minHeight: 92, opacity: 0.45,
                }} />
              ))}
            </div>
          )}

          {error && !loading && (
            <div style={{
              background: 'var(--danger-soft)', border: '1px solid rgba(160,66,48,.30)',
              borderRadius: 'var(--radius)', padding: 16, fontSize: 'var(--t-small-fs)', color: 'var(--danger)',
            }}>
              {error} —{' '}
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'var(--t-small-fs)' }}
              >
                erneut versuchen
              </button>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="gobl-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h3 style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontSize: 'var(--t-h3-fs)', lineHeight: 'var(--t-h3-lh)', fontWeight: 600, color: 'var(--ink-1)',
                margin: '0 0 6px',
              }}>
                Bau dein erstes Projekt
              </h3>
              <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ink-3)', margin: '0 0 20px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
                Sag Goblin oben, was du bauen willst — Goblin schreibt den Code, du deployst.
              </p>
              <button type="button" className="gobl-btn primary" onClick={() => setShowNewProjectModal(true)}>
                Neues Projekt
              </button>
            </div>
          )}

          {/* DESKTOP — compact card grid. Hidden ≤480px (see <style> below). */}
          {!loading && !error && projects.length > 0 && (
            <div className="gobl-proj-grid">
              {projects.map((p, i) => {
                const status = statusLabel(p.status);
                const dot = p.color ?? DOT_COLORS[i % DOT_COLORS.length]!;
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/project/${p.id}`}
                    className="gobl-panel"
                    style={{
                      padding: 14, display: 'flex', flexDirection: 'column', gap: 6,
                      minHeight: 92, textDecoration: 'none', color: 'inherit',
                      transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-strong)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-eyebrow-fs)',
                        letterSpacing: 'var(--t-eyebrow-ls)', color: 'var(--ink-3)', textTransform: 'uppercase',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
                        {status.label}
                      </span>
                      <span style={{ color: 'var(--ink-3)', fontSize: 'var(--t-mono-fs)' }}>→</span>
                    </div>
                    <h3 style={{
                      fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                      fontWeight: 600, fontSize: 'var(--t-h4-fs)', letterSpacing: '-0.014em',
                      color: 'var(--ink-1)', lineHeight: 'var(--t-h4-lh)', margin: '2px 0 0',
                    }}>
                      {p.name}
                    </h3>
                    {p.description && (
                      <p style={{
                        fontSize: 'var(--t-caption-fs)', color: 'var(--ink-2)', lineHeight: 1.4, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {p.description}
                      </p>
                    )}
                    <div style={{
                      marginTop: 'auto', fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 'var(--t-eyebrow-fs)', color: 'var(--ink-3)', letterSpacing: '0.06em',
                      display: 'flex', justifyContent: 'space-between',
                      paddingTop: 9, borderTop: '1px solid var(--line)',
                    }}>
                      <span>{p.github_repo ? p.github_repo.split('/').pop()?.toUpperCase() : 'PROJEKT'}</span>
                      <span>{timeAgo(p.updated_at ?? p.last_active) || '—'}</span>
                    </div>
                    <span style={{ background: dot, width: 0, height: 0 }} aria-hidden /> {/* keep dot color referenced */}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                style={{
                  background: 'transparent', border: '1px dashed var(--line-strong)',
                  borderRadius: 'var(--radius-lg)', minHeight: 92,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-3)', fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  fontWeight: 600, fontSize: 'var(--t-button-fs)', cursor: 'pointer', gap: 8,
                  transition: 'color .15s, border-color .15s, border-style .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderStyle = 'solid'; e.currentTarget.style.color = 'var(--ink-1)'; e.currentTarget.style.borderColor = 'var(--ink-1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderStyle = 'dashed'; e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--line-strong)'; }}
              >
                + Neues Projekt
              </button>
            </div>
          )}

          {/* MOBILE — compact list (slim rows). Shown only ≤480px. Same data,
              two deliberate layouts (TASK 5). */}
          {!loading && !error && projects.length > 0 && (
            <div className="gobl-proj-list gobl-panel" style={{ overflow: 'hidden' }}>
              {projects.map((p, i) => {
                const status = statusLabel(p.status);
                const last = i === projects.length - 1;
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/project/${p.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', minHeight: 48,
                      borderBottom: last ? 'none' : '1px solid var(--line)',
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
                    <span style={{
                      flex: 1, minWidth: 0, fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                      fontWeight: 600, fontSize: 'var(--t-small-fs)', color: 'var(--ink-1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </span>
                    <span style={{
                      flexShrink: 0, fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 'var(--t-eyebrow-fs)', color: 'var(--ink-3)', letterSpacing: '0.06em',
                    }}>
                      {timeAgo(p.updated_at ?? p.last_active) || '—'}
                    </span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 14px', minHeight: 48, background: 'transparent',
                  border: 'none', borderTop: '1px solid var(--line)', cursor: 'pointer',
                  color: 'var(--ink-2)', fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  fontWeight: 600, fontSize: 'var(--t-small-fs)',
                }}
              >
                + Neues Projekt
              </button>
            </div>
          )}
        </section>

        {/* What's new (Variant A list — kept). */}
        <section>
          <div className="gobl-section-title">
            <h2>Was ist neu</h2>
            {/* TODO: point to a dedicated changelog route once it exists
                (e.g. /dashboard/changelog). /help is the closest real
                destination today — no dead href="#". */}
            <Link href="/help">Alle Updates →</Link>
          </div>

          <div className="gobl-panel" style={{ overflow: 'hidden' }}>
            {UPDATES.map((u, i) => {
              const last = i === UPDATES.length - 1;
              const tagClass = u.tone === 'gold' ? 'gobl-tag gold' : u.tone === 'warn' ? 'gobl-tag warn' : 'gobl-tag';
              return (
                <div key={u.title} style={{
                  padding: '16px 18px',
                  borderBottom: last ? 'none' : '1px solid var(--line)',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <span className={tagClass} style={{ marginTop: 2, flexShrink: 0 }}>{u.tag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                      fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                      fontWeight: 600, fontSize: 'var(--t-small-fs)', color: 'var(--ink-1)',
                      margin: '0 0 3px', letterSpacing: '-0.012em',
                    }}>
                      {u.title}
                    </h4>
                    <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                      {u.desc}
                    </p>
                  </div>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-eyebrow-fs)',
                    color: 'var(--ink-3)', letterSpacing: '0.08em',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {u.date}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
