'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/contexts/app-context';
import { ChatInput, useChatModel } from '@/components/chat/ChatInput';
import { filterVisibleProjects } from '@/lib/project-visibility';
import { fetchWithRetryOn429 } from '@/lib/api';
import { friendlyError } from '@/lib/friendly-error';
import { useLang, readLang, t } from '@/lib/use-lang';

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
  {
    tag: 'NEU',
    tone: 'gold',
    titleDe: 'Claude Sonnet 4.6 verfügbar',
    titleEn: 'Claude Sonnet 4.6 available',
    descDe: 'Goblin nutzt dein eigenes Anthropic-Konto automatisch.',
    descEn: 'Goblin automatically uses your own Anthropic account.',
    dateDe: 'MAI 22',
    dateEn: 'MAY 22',
  },
  {
    tag: 'NEU',
    tone: 'gold',
    titleDe: 'BYOK-Streaming stabilisiert',
    titleEn: 'BYOK streaming stabilized',
    descDe: 'Anthropic, OpenAI und Groq streamen wieder ohne Abbrüche.',
    descEn: 'Anthropic, OpenAI, and Groq stream again without interruptions.',
    dateDe: 'MAI 20',
    dateEn: 'MAY 20',
  },
  {
    tag: 'UPDATE',
    tone: 'plain',
    titleDe: 'Send to Code auf dem Handy',
    titleEn: 'Send to Code on mobile',
    descDe: 'Code aus dem Chat in den Editor schieben — funktioniert auch unterwegs.',
    descEn: 'Push code from chat into the editor — works on the go too.',
    dateDe: 'APR 14',
    dateEn: 'APR 14',
  },
  {
    tag: 'SICHERHEIT',
    tone: 'warn',
    titleDe: 'CORS und Stream-Abbrüche gehärtet',
    titleEn: 'CORS and stream interruptions hardened',
    descDe: 'Stabilität und Abbruch-Verhalten in allen Routen verbessert.',
    descEn: 'Stability and abort behaviour improved across all routes.',
    dateDe: 'APR 08',
    dateEn: 'APR 08',
  },
] as const;

// Quick prompts — plain user language, not dev jargon.
const QUICK_PROMPTS_DE = [
  'Eine Landingpage mit Anmeldeformular',
  'Eine Aufgabenliste, die meine Einträge merkt',
  'Eine Seite, auf der Leute Termine buchen können',
  'Magic-Link-Login für meine Next.js-App',
];
const QUICK_PROMPTS_EN = [
  'A landing page with a sign-up form',
  'A to-do list that remembers my entries',
  'A page where people can book appointments',
  'Magic-link login for my Next.js app',
];

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const lang = readLang();
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (lang === 'en') {
    if (m < 2) return 'JUST NOW';
    if (h < 1) return `${m} MIN AGO`;
    if (h < 24) return `${h} HR AGO`;
    if (d < 30) return `${d} ${d === 1 ? 'DAY' : 'DAYS'} AGO`;
    const mo = Math.floor(d / 30);
    return `${mo} ${mo === 1 ? 'MONTH' : 'MONTHS'} AGO`;
  }
  if (m < 2) return 'GERADE EBEN';
  if (h < 1) return `VOR ${m} MIN`;
  if (h < 24) return `VOR ${h} STD`;
  if (d < 30) return `VOR ${d} ${d === 1 ? 'TAG' : 'TAGEN'}`;
  const mo = Math.floor(d / 30);
  return `VOR ${mo} ${mo === 1 ? 'MONAT' : 'MONATEN'}`;
}

function statusLabel(s?: string | null): { label: string; color: string } {
  const lang = readLang();
  switch ((s ?? 'idle').toLowerCase()) {
    case 'shipping': return { label: lang === 'en' ? 'SHIPPING' : 'WIRD VERÖFFENTLICHT', color: 'var(--gold)' };
    case 'live':     return { label: 'LIVE', color: '#6db97b' };
    case 'draft':    return { label: lang === 'en' ? 'DRAFT' : 'ENTWURF', color: '#7A4A8A' };
    case 'archived': return { label: lang === 'en' ? 'ARCHIVED' : 'ARCHIVIERT', color: '#3A6B8A' };
    default:         return { label: lang === 'en' ? 'ACTIVE' : 'AKTIV', color: 'var(--gold)' };
  }
}

// Casual variants sprinkled in ~30% of loads so the greeting never reads like
// a robotic elevator announcement. Time-of-day picks the default base.
const GREETING_CASUAL_DE = ['Hi', 'Servus', 'Schön dich zu sehen', 'Bereit zum Bauen', 'Aloha'];
const GREETING_CASUAL_EN = ['Hi', 'Hey', 'Good to see you', 'Ready to build', 'Aloha'];

function buildGreeting(firstName: string): string {
  const lang = readLang();
  const h = new Date().getHours();
  if (lang === 'en') {
    const base =
      h < 5  ? 'Hello' :
      h < 11 ? 'Good morning' :
      h < 17 ? 'Hello' :
      h < 23 ? 'Good evening' : 'Hello';
    const casual = GREETING_CASUAL_EN;
    const word = Math.random() < 0.3
      ? casual[Math.floor(Math.random() * casual.length)]!
      : base;
    const suffix = word === 'Ready to build' ? '!' : '';
    return `${word}, ${firstName}${suffix}`;
  }
  const base =
    h < 5  ? 'Hallo' :
    h < 11 ? 'Guten Morgen' :
    h < 17 ? 'Hallo' :
    h < 23 ? 'Guten Abend' : 'Hallo';
  const casual = GREETING_CASUAL_DE;
  const word = Math.random() < 0.3
    ? casual[Math.floor(Math.random() * casual.length)]!
    : base;
  const suffix = word === 'Bereit zum Bauen' ? '?' : '';
  return `${word}, ${firstName}${suffix}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const lang = useLang();
  const { showNewProjectModal, setShowNewProjectModal, setNewProjectIdea, setNewProjectModel } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Hero composer is the real shared ChatInput. We keep only the model state
  // and a "prefill" channel for the quick-prompt chips → ChatInput.
  const { selectedModel, setSelectedModel } = useChatModel();
  const [prefill, setPrefill] = useState('');
  // B-S3: "Sag Goblin" submit no longer silently makes a chat — it asks whether
  // to start a project, add to one, or just chat.
  const [choicePrompt, setChoicePrompt] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.push('/login'); return; }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      // P1.10: retry a transient 429 (dashboard mount burst vs generalRateLimit)
      // before surfacing "Projekte konnten nicht geladen werden".
      const [projRes, meRes] = await Promise.all([
        fetchWithRetryOn429(`${apiBase}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithRetryOn429(`${apiBase}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!projRes.ok) throw new Error('Projekte konnten nicht geladen werden');
      setProjects(filterVisibleProjects(await projRes.json()));

      if (meRes.ok) {
        const me = await meRes.json();
        setDisplayName(me.displayName ?? null);
      }
    } catch (err) {
      setError(friendlyError(err, 'Etwas ist schiefgelaufen'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Post-onboarding hand-off (A-S11): finishing onboarding lands here with
  // ?start=1 so the user opens the project-create flow first, not chat. Read
  // from location (not useSearchParams) to avoid a Suspense boundary, and strip
  // the param so a refresh doesn't reopen the modal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('start') === '1') {
      setShowNewProjectModal(true);
      params.delete('start');
      const qs = params.toString();
      window.history.replaceState(null, '', `/dashboard${qs ? `?${qs}` : ''}`);
    }
  }, [setShowNewProjectModal]);

  const prevModalOpen = useRef(false);
  useEffect(() => {
    if (prevModalOpen.current && !showNewProjectModal) loadProjects();
    prevModalOpen.current = showNewProjectModal;
  }, [showNewProjectModal, loadProjects]);

  // Send composer text → create chat session + jump to it with the prompt prefilled.
  // Server creates session, then we navigate; the chat session page picks up the
  // sessionStorage seed (single-use, cleared on read).
  const sendComposer = useCallback(async (text: string, projectId?: string) => {
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
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      if (!res.ok) return;
      const created = await res.json() as { id: string };
      try {
        sessionStorage.setItem(`goblin:seed:${created.id}`, trimmed);
        // F2: carry the picked model so the new chat runs it (not the localStorage
        // default). The dashboard composer's pick lives only in component state
        // (onModelChange=setSelectedModel, which doesn't persist), so without this
        // the chat's own useChatModel would fall back to the stored default.
        sessionStorage.setItem(`goblin:seedModel:${created.id}`, JSON.stringify(selectedModel));
      } catch { /* ignore */ }
      router.push(`/dashboard/chat/${created.id}`);
    } catch { /* network error → leave user on the page, do not crash */ }
  }, [router, selectedModel]);

  const activeCount = projects.filter(p => (p.status ?? 'idle') !== 'archived').length;

  // First name only, comma, name last — "Guten Morgen, Vincent" (not the old
  // "Vincent Hafner Guten Morgen").
  const firstName = (displayName ?? 'Du').split(' ')[0]!;
  // WS-C: buildGreeting uses new Date().getHours() + Math.random() — both differ
  // between the SSR pass and the client, so computing it during render tripped a
  // hydration mismatch (React #418). Compute it post-mount instead: first paint
  // renders an empty span on both server and client (no mismatch), then the
  // effect fills the time-of-day greeting in.
  const [greeting, setGreeting] = useState('');
  useEffect(() => { setGreeting(buildGreeting(firstName)); }, [firstName]);

  const quickPrompts = t(lang, QUICK_PROMPTS_DE, QUICK_PROMPTS_EN);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      {/* New Project modal is rendered globally in dashboard-shell (B-S6). */}

      {choicePrompt !== null && (
        <SagGoblinChoice
          prompt={choicePrompt}
          projects={projects}
          onClose={() => setChoicePrompt(null)}
          onNewProject={() => { setNewProjectIdea(choicePrompt); setNewProjectModel(JSON.stringify(selectedModel)); setChoicePrompt(null); setShowNewProjectModal(true); }}
          onExistingProject={(id) => { const p = choicePrompt; setChoicePrompt(null); sendComposer(p, id); }}
          onJustChat={() => { const p = choicePrompt; setChoicePrompt(null); sendComposer(p); }}
        />
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
        {/* P0-1 (DD): NO `overflow: hidden` here. The hero hosts the shared
            ChatInput whose model dropdown (ModelHub) opens downward and must escape
            the card; `overflow: hidden` clipped it so the model list rendered cut
            off / behind the card below. border-radius still rounds the dark fill
            (background is clipped to the border-box), only the popover escapes. */}
        <section className="gobl-hero" style={{
          background: 'var(--ink-deep)', color: 'var(--bone)',
          borderRadius: 'var(--radius-lg)', padding: '28px 28px 22px',
          marginBottom: 36, border: '1px solid rgba(244,236,216,.12)',
          position: 'relative',
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
            {t(lang,
              <>Sag Goblin, was du <span className="gobl-serif">bauen willst.</span></>,
              <>Tell Goblin what you want <span className="gobl-serif">to build.</span></>
            )}
          </h1>

          {/* Real shared ChatInput in hero arrangement — same component as
              screens 05/06, configured via variant="hero". Submitting starts
              a new chat (create session → seed prompt → navigate). */}
          <ChatInput
            variant="hero"
            placeholder={t(lang,
              'Eine Landingpage mit Stripe-Bezahlung in Next.js…',
              'A landing page with Stripe checkout in Next.js…'
            )}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            prefill={prefill}
            onSubmit={(message) => { const tVal = message.trim(); if (tVal) setChoicePrompt(tVal); }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {quickPrompts.map(q => (
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
            <h2>{t(lang, 'Deine Projekte', 'Your projects')}</h2>
            <span className="label">{loading ? '…' : `${activeCount} ${t(lang, 'AKTIV', 'ACTIVE')}`}</span>
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
                {t(lang, 'erneut versuchen', 'try again')}
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
                {t(lang, 'Bau dein erstes Projekt', 'Build your first project')}
              </h3>
              <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ink-3)', margin: '0 0 20px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
                {t(lang,
                  'Sag Goblin oben, was du bauen willst — Goblin schreibt den Code, du deployst.',
                  'Tell Goblin above what you want to build — Goblin writes the code, you deploy.'
                )}
              </p>
              <button type="button" className="gobl-btn primary" onClick={() => setShowNewProjectModal(true)}>
                {t(lang, 'Neues Projekt', 'New project')}
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
                {t(lang, '+ Neues Projekt', '+ New project')}
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
                {t(lang, '+ Neues Projekt', '+ New project')}
              </button>
            </div>
          )}
        </section>

        {/* What's new (Variant A list — kept). */}
        <section>
          <div className="gobl-section-title">
            <h2>{t(lang, 'Was ist neu', "What's new")}</h2>
            {/* Labelled for its real destination: the link goes to /help, so it
                says Help & FAQ rather than promising a changelog it doesn't reach.
                A dedicated changelog route can reclaim an "All updates" label later. */}
            <Link href="/help">{t(lang, 'Hilfe & FAQ →', 'Help & FAQ →')}</Link>
          </div>

          <div className="gobl-panel" style={{ overflow: 'hidden' }}>
            {UPDATES.map((u, i) => {
              const last = i === UPDATES.length - 1;
              const tagClass = u.tone === 'gold' ? 'gobl-tag gold' : u.tone === 'warn' ? 'gobl-tag warn' : 'gobl-tag';
              return (
                <div key={u.titleDe} style={{
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
                      {t(lang, u.titleDe, u.titleEn)}
                    </h4>
                    <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                      {t(lang, u.descDe, u.descEn)}
                    </p>
                  </div>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-eyebrow-fs)',
                    color: 'var(--ink-3)', letterSpacing: '0.08em',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {t(lang, u.dateDe, u.dateEn)}
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

// B-S3 — when the user submits the dashboard "Sag Goblin" composer, ask what
// they meant instead of silently creating a chat. Default highlight: new project.
function SagGoblinChoice({
  prompt, projects, onClose, onNewProject, onExistingProject, onJustChat,
}: {
  prompt: string;
  projects: Project[];
  onClose: () => void;
  onNewProject: () => void;
  onExistingProject: (projectId: string) => void;
  onJustChat: () => void;
}) {
  const lang = useLang();
  const [picking, setPicking] = useState(false);
  const active = projects.filter(p => (p.status ?? 'idle') !== 'archived');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 300 }} />
      <div role="dialog" aria-label={t(lang, 'Was möchtest du tun?', 'What do you want to do?')} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 48px)', overflow: 'auto',
        background: 'var(--panel)', borderRadius: 16, zIndex: 301, boxShadow: 'var(--shadow-lg)',
        padding: 22,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-eyebrow-fs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--meta)', marginBottom: 8 }}>
          {t(lang, 'Sag Goblin', 'Tell Goblin')}
        </div>
        <h3 style={{ fontFamily: 'var(--font-dash-display), Manrope, sans-serif', fontSize: 'var(--t-h4-fs)', fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 4px' }}>
          {t(lang, 'Womit fangen wir an?', 'Where do we start?')}
        </h3>
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          „{prompt}"
        </p>

        {!picking ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" onClick={onNewProject} style={choiceBtn(true)}>
              <span style={{ fontWeight: 600 }}>{t(lang, 'Neues Projekt erstellen', 'Create new project')}</span>
              <span style={choiceSub()}>{t(lang,
                'Goblin baut es als richtiges Projekt — mit Code, Deploy und allem.',
                'Goblin builds it as a real project — with code, deploy, and everything.'
              )}</span>
            </button>
            <button type="button" onClick={() => active.length ? setPicking(true) : onNewProject()} style={choiceBtn(false)}>
              <span style={{ fontWeight: 600 }}>{t(lang, 'Zu bestehendem Projekt hinzufügen', 'Add to an existing project')}</span>
              <span style={choiceSub()}>{active.length
                ? t(lang, 'Weiter an einem deiner Projekte arbeiten.', 'Keep working on one of your projects.')
                : t(lang, 'Du hast noch kein Projekt — neues erstellen.', 'You have no project yet — create one.')
              }</span>
            </button>
            <button type="button" onClick={onJustChat} style={choiceBtn(false)}>
              <span style={{ fontWeight: 600 }}>{t(lang, 'Nur kurz im Chat probieren', 'Just try it quickly in chat')}</span>
              <span style={choiceSub()}>{t(lang, 'Schnell etwas ausprobieren, ohne Projekt.', 'Try something quickly, no project.')}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={() => setPicking(false)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--meta)', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', padding: 0, marginBottom: 4 }}>
              {t(lang, '← Zurück', '← Back')}
            </button>
            {active.map(p => (
              <button key={p.id} type="button" onClick={() => onExistingProject(p.id)} style={choiceBtn(false)}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function choiceBtn(primary: boolean): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', gap: 3, width: '100%', textAlign: 'left',
    padding: '13px 16px', borderRadius: 11, cursor: 'pointer',
    border: primary ? '2px solid var(--brand-green)' : '1.5px solid var(--border)',
    background: primary ? 'rgba(45,74,43,0.06)' : 'var(--surface)',
    color: 'var(--ink-1)', fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
    fontSize: 'var(--t-small-fs)',
  };
}
function choiceSub(): React.CSSProperties {
  return { fontWeight: 400, fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', lineHeight: 1.4 };
}
