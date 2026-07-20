'use client';

import { useEffect, useState } from 'react';

interface SourceStatus {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_status: 'ok' | 'fail' | 'disabled' | null;
  last_error: string | null;
  last_record_count: number;
}

function statusColor(status: SourceStatus['last_status'], enabled: boolean): string {
  if (!enabled || status === 'disabled') return 'var(--text-meta)';
  if (status === 'ok') return 'var(--brand-green)';
  return 'var(--rust)';
}

function statusLabel(status: SourceStatus['last_status'], enabled: boolean): string {
  if (!enabled || status === 'disabled') return 'disabled';
  return status ?? '—';
}

export default function AdminRankingsPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    // Public sources endpoint works for admin page too (no secrets in it).
    fetch(`${apiBase}/api/rankings/sources`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`${r.status}`)))
      .then((data) => setSources(data.sources ?? []))
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return (
      <div style={{ padding: 64, textAlign: 'center', color: 'var(--rust)' }}>Fehler: {error}</div>
    );

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      <h1
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 28,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        Rankings — Source Status
      </h1>

      {/* U4c: overflow-x auto so the 4-col table scrolls on a phone. */}
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={cellStyle(true)}>Source</th>
            <th style={cellStyle(true)}>Status</th>
            <th style={cellStyle(true)}>Last Fetch</th>
            <th style={cellStyle(true)}>Records</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const isDisabled = !s.enabled || s.last_status === 'disabled';
            return (
              <tr
                key={s.id}
                style={{
                  borderBottom: '1px solid var(--border-hairline)',
                  opacity: isDisabled ? 0.55 : 1,
                }}
              >
                <td style={cellStyle(false)}>{s.name}</td>
                <td style={cellStyle(false)}>
                  <span
                    title={s.last_error ?? undefined}
                    style={{
                      color: statusColor(s.last_status, s.enabled),
                      fontWeight: 600,
                      cursor: s.last_error ? 'help' : 'default',
                    }}
                  >
                    {statusLabel(s.last_status, s.enabled)}
                  </span>
                </td>
                <td style={cellStyle(false)}>
                  {s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString('de-CH') : '—'}
                </td>
                <td style={cellStyle(false)}>{s.last_record_count ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <p style={{ marginTop: 24, fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)' }}>
        Manual trigger:{' '}
        {/* U4c: allow the long curl string to wrap/scroll instead of overflowing
            the content box on a phone. */}
        <code style={{ fontFamily: 'var(--font-mono)', display: 'block', marginTop: 6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          curl -X POST -H "x-admin-key: $ADMIN_API_KEY"
          $API_URL/api/admin/rankings/refresh
        </code>
      </p>
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
