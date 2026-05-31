'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getModelAccess, ACCESS_COLORS } from '@/lib/model-access';

interface ModelDetail {
  model: {
    id: string;
    provider: string;
    display_name: string;
    family: string;
    context_tokens: number | null;
    pricing_in_per_million: number | null;
    pricing_out_per_million: number | null;
    is_open_source: boolean;
    released_at: string | null;
  };
  per_source_rankings: Array<{
    source_id: string;
    dimension: string;
    normalized_score: number;
    raw_score: number;
    rank_in_source: number;
  }>;
  composite_rankings: Array<{
    task_type: string;
    composite_score: number;
    rank: number;
    source_count: number;
  }>;
  history: Array<{
    source_id: string;
    dimension: string;
    normalized_score: number;
    run_at: string;
  }>;
}

export default function ModelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent((params?.id as string) ?? '');
  const [data, setData] = useState<ModelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    fetch(`${apiBase}/api/rankings/models/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <Centered>Fehler: {error}</Centered>;
  if (!data) return <Centered>Lade…</Centered>;

  const m = data.model;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)', fontFamily: 'var(--font-sans)' }}>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        <Link href="/models" style={{ color: 'var(--text-meta)', textDecoration: 'none', fontSize: 'var(--t-small-fs)' }}>
          ← Alle Modelle
        </Link>

        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 32,
            fontWeight: 600,
            color: 'var(--text-1)',
            margin: '16px 0 4px',
          }}
        >
          {m.display_name}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-meta)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 24,
          }}
        >
          {m.id}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Stat label="Provider" value={m.provider} />
          <Stat label="Family" value={m.family} />
          <Stat
            label="Context"
            value={m.context_tokens ? `${(m.context_tokens / 1000).toFixed(0)}k` : '—'}
          />
          <Stat label="Open Source" value={m.is_open_source ? 'Yes' : 'No'} />
          <Stat
            label="In Price"
            value={
              m.pricing_in_per_million ? `$${m.pricing_in_per_million.toFixed(2)}/M` : '—'
            }
          />
          <Stat
            label="Out Price"
            value={
              m.pricing_out_per_million ? `$${m.pricing_out_per_million.toFixed(2)}/M` : '—'
            }
          />
        </div>

        <AccessExplanation provider={m.provider} />

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Composite Rankings</h2>
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: 32,
          }}
        >
          {data.composite_rankings.map((c, i) => (
            <div
              key={c.task_type}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom:
                  i < data.composite_rankings.length - 1 ? '1px solid var(--border-hairline)' : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 15, textTransform: 'capitalize' }}>
                {c.task_type}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-meta)', marginRight: 16 }}>
                #{c.rank} · {c.source_count} Quellen
              </span>
              <span style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {(c.composite_score * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Per-Source Scores</h2>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={cellStyle(true)}>Source</th>
              <th style={cellStyle(true)}>Dimension</th>
              <th style={cellStyle(true)}>Score</th>
              <th style={cellStyle(true)}>Rank</th>
            </tr>
          </thead>
          <tbody>
            {data.per_source_rankings.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <td style={cellStyle(false)}>{r.source_id}</td>
                <td style={cellStyle(false)}>{r.dimension}</td>
                <td style={cellStyle(false)}>{(r.normalized_score * 100).toFixed(0)}</td>
                <td style={cellStyle(false)}>#{r.rank_in_source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-meta)' }}>{label}</div>
      <div style={{ fontSize: 'var(--t-body-fs)', fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function cellStyle(header: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: header ? 600 : 400,
    color: header ? 'var(--text-meta)' : 'var(--text-1)',
  };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-meta)' }}>{children}</div>
  );
}

function AccessExplanation({ provider }: { provider: string }) {
  const access = getModelAccess(provider);
  const c = ACCESS_COLORS[access.type];
  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: 12,
      background: c.bg,
      borderLeft: `3px solid ${c.fg}`,
      marginBottom: 28,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 600, marginBottom: 6,
        color: c.fg, fontFamily: 'var(--font-sans)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        Zugang · {access.label}
      </div>
      <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-1)', margin: '0 0 12px', lineHeight: 1.55 }}>
        {access.description}
      </p>
      <Link
        href={access.setupHref}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px',
          background: 'var(--brand-green)',
          color: '#fff', borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Setup starten →
      </Link>
    </div>
  );
}
