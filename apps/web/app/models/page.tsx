'use client';

import { useEffect, useState } from 'react';
// FINAL-POLISH · U7.3: /models is PUBLIC (middleware.ts isPublic) and was written in
// German only, so an English visitor evaluating the model rankings hit a German wall.
// Bound to the public/pre-auth locale binding, the same one /help and the legal pages use.
import { t as tr } from '@/lib/use-lang';
import { useAuthLang } from '@/lib/use-auth-lang';
import Link from 'next/link';
import { getModelAccess, ACCESS_COLORS } from '@/lib/model-access';

type TaskType = 'coding' | 'reasoning' | 'speed' | 'cost-efficiency' | 'general';

interface RankingRow {
  rank: number;
  composite_score: number;
  source_count: number;
  contributing_sources: string[];
  computed_at: string;
  ranked_models: {
    id: string;
    provider: string;
    display_name: string;
    family: string;
    context_tokens: number | null;
    pricing_in_per_million: number | null;
    pricing_out_per_million: number | null;
    is_open_source: boolean;
  };
}

// The pill labels are proper nouns of the benchmark world and stay as-is in both
// languages; only the descriptions are prose.
const TASKS: Array<{ id: TaskType; label: string; de: string; en: string }> = [
  { id: 'coding', label: 'Coding', de: 'Code-Generation, Debugging, Refactoring', en: 'Code generation, debugging, refactoring' },
  { id: 'reasoning', label: 'Reasoning', de: 'Komplexe Logik, Mehrschritt-Aufgaben', en: 'Complex logic, multi-step tasks' },
  { id: 'speed', label: 'Speed', de: 'Schnelle Antworten, niedrige Latenz', en: 'Fast answers, low latency' },
  { id: 'cost-efficiency', label: 'Cost', de: 'Preis-Leistung pro Token', en: 'Value per token' },
  { id: 'general', label: 'General', de: 'Ausgewogen über alle Tasks', en: 'Balanced across all tasks' },
];

export default function ModelsPage() {
  const lang = useAuthLang();
  const [task, setTask] = useState<TaskType>('coding');
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    setLoading(true);
    setError(null);
    fetch(`${apiBase}/api/rankings?task=${task}&limit=30`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`${r.status}`)))
      .then((data) => setRankings(data.rankings ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [task]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)', fontFamily: 'var(--font-sans)' }}>
      {/* WAVE-KORREKTUR-1 · U1 — public full-screen page; its 32px top padding is
          smaller than an iOS top inset, so the h1 landed under the clock in the
          installed PWA. Absorb the inset here, once; --surface-2 continues into it. */}
      <main style={{
        maxWidth: 1100, margin: '0 auto', padding: '32px 16px',
        paddingTop: 'max(32px, calc(env(safe-area-inset-top, 0px) + 12px))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
      }}>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(28px, 5vw, 40px)',
            fontWeight: 600,
            color: 'var(--text-1)',
            margin: 0,
            marginBottom: 8,
          }}
        >
          {tr(lang, 'Modelle, geordnet nach echten Benchmarks.', 'Models, ranked by real benchmarks.')}
        </h1>
        <p style={{ fontSize: 'var(--t-body-fs)', color: 'var(--text-2)', marginBottom: 32, maxWidth: 720 }}>
          {tr(
            lang,
            'Goblin aggregiert alle 6 Stunden Daten aus 5 öffentlichen Quellen (OpenRouter, Aider, LiveBench, HuggingFace, SWE-Bench) und zeigt dir, welches LLM heute am besten für deinen Task ist.',
            'Every 6 hours Goblin aggregates data from 5 public sources (OpenRouter, Aider, LiveBench, HuggingFace, SWE-Bench) and shows you which LLM is best for your task today.',
          )}
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            marginBottom: 24,
            paddingBottom: 4,
          }}
        >
          {TASKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTask(t.id)}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)',
                background: task === t.id ? 'var(--brand-green)' : 'var(--surface-1)',
                color: task === t.id ? '#FFFFFF' : 'var(--text-1)',
                fontSize: 'var(--t-small-fs)',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              data-testid={`task-pill-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p style={{ color: 'var(--text-meta)', fontSize: 'var(--t-small-fs)', marginBottom: 24 }}>
          {(() => { const sel = TASKS.find((x) => x.id === task); return sel ? tr(lang, sel.de, sel.en) : null; })()}
        </p>

        {loading && <p style={{ color: 'var(--text-meta)' }}>{tr(lang, 'Lade Rankings …', 'Loading rankings …')}</p>}
        {error && <p style={{ color: 'var(--rust)' }}>{tr(lang, 'Fehler', 'Error')}: {error}</p>}
        {!loading && !error && rankings.length === 0 && (
          <p style={{ color: 'var(--text-meta)' }}>
            {tr(lang, 'Noch keine Daten. Die Aggregation läuft alle 6 Stunden.', 'No data yet. Aggregation runs every 6 hours.')}
          </p>
        )}

        {!loading && rankings.length > 0 && (
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {rankings.map((r, i) => {
              const access = getModelAccess(r.ranked_models.provider);
              const accessColor = ACCESS_COLORS[access.type];
              return (
                <Link
                  key={r.ranked_models.id}
                  href={`/models/${encodeURIComponent(r.ranked_models.id)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 20px',
                    borderBottom:
                      i < rankings.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                  data-testid={`rank-row-${r.ranked_models.id}`}
                >
                  <span
                    style={{
                      width: 32,
                      fontSize: 'var(--t-small-fs)',
                      fontWeight: 600,
                      color: r.rank <= 3 ? 'var(--brand-green)' : 'var(--text-meta)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    #{r.rank}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--t-body-fs)', fontWeight: 600, color: 'var(--text-1)' }}>
                      {r.ranked_models.display_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: accessColor.bg,
                        color: accessColor.fg,
                        border: `1px solid ${accessColor.border}`,
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '0.02em',
                      }}>
                        {access.label}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: 'var(--text-meta)',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {r.ranked_models.provider}
                      </span>
                    </div>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: scoreBg(r.composite_score),
                        color: scoreFg(r.composite_score),
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {(r.composite_score * 100).toFixed(0)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-meta)' }}>
                      aus {r.source_count}
                    </span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-meta)', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}

        <p style={{ color: 'var(--text-meta)', fontSize: 'var(--t-caption-fs)', marginTop: 24, textAlign: 'center' }}>
          {rankings.length > 0 && rankings[0]?.computed_at
            ? `Letztes Update: ${new Date(rankings[0].computed_at).toLocaleString('de-CH')}`
            : ''}
        </p>
      </main>
    </div>
  );
}

function scoreBg(score: number): string {
  if (score >= 0.75) return 'color-mix(in srgb, var(--brand-green) 8%, transparent)';
  if (score >= 0.5) return 'color-mix(in srgb, var(--brand-gold) 12%, transparent)';
  return 'var(--surface-2)';
}

function scoreFg(score: number): string {
  if (score >= 0.75) return 'var(--brand-green)';
  if (score >= 0.5) return 'var(--gold-700)';
  return 'var(--text-2)';
}
