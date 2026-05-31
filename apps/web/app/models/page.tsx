'use client';

import { useEffect, useState } from 'react';
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

const TASKS: Array<{ id: TaskType; label: string; description: string }> = [
  { id: 'coding', label: 'Coding', description: 'Code-Generation, Debugging, Refactoring' },
  { id: 'reasoning', label: 'Reasoning', description: 'Komplexe Logik, Mehrschritt-Aufgaben' },
  { id: 'speed', label: 'Speed', description: 'Schnelle Antworten, niedrige Latenz' },
  { id: 'cost-efficiency', label: 'Cost', description: 'Preis-Leistung pro Token' },
  { id: 'general', label: 'General', description: 'Ausgewogen über alle Tasks' },
];

export default function ModelsPage() {
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
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
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
          Modelle, geordnet nach echten Benchmarks.
        </h1>
        <p style={{ fontSize: 'var(--t-body-fs)', color: 'var(--text-2)', marginBottom: 32, maxWidth: 720 }}>
          Goblin aggregiert alle 6 Stunden Daten aus 5 öffentlichen Quellen (OpenRouter, Aider,
          LiveBench, HuggingFace, SWE-Bench) und zeigt dir, welches LLM heute am besten für deinen
          Task ist.
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
          {TASKS.find((t) => t.id === task)?.description}
        </p>

        {loading && <p style={{ color: 'var(--text-meta)' }}>Lade Rankings...</p>}
        {error && <p style={{ color: 'var(--rust)' }}>Fehler: {error}</p>}
        {!loading && !error && rankings.length === 0 && (
          <p style={{ color: 'var(--text-meta)' }}>Noch keine Daten. Cron läuft alle 6h.</p>
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
