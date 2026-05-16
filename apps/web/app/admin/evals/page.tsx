export const dynamic = 'force-dynamic';

interface EvalRow {
  task_id: string;
  provider: string;
  model: string;
  score: number | string;
  compiled: boolean;
  latency_ms: number;
  cost_usd: number | string | null;
  error: string | null;
}

interface LatestRun {
  run_id: string | null;
  timestamp: string | null;
  results: EvalRow[];
}

interface Trend {
  day: string;
  provider: string;
  avg_score: number;
  runs: number;
}

async function fetchEvals(): Promise<{ latest: LatestRun; trends: Trend[] } | { error: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!apiUrl) return { error: 'NEXT_PUBLIC_API_URL not set' };
  if (!adminKey) return { error: 'ADMIN_API_KEY not set (server-side)' };
  try {
    const [latestRes, trendRes] = await Promise.all([
      fetch(`${apiUrl}/api/admin/evals/latest`, { headers: { 'x-admin-key': adminKey }, cache: 'no-store' }),
      fetch(`${apiUrl}/api/admin/evals/trends`, { headers: { 'x-admin-key': adminKey }, cache: 'no-store' }),
    ]);
    if (!latestRes.ok) return { error: `latest ${latestRes.status}` };
    if (!trendRes.ok) return { error: `trends ${trendRes.status}` };
    const latest = await latestRes.json() as LatestRun;
    const trendsBody = await trendRes.json() as { trends: Trend[] };
    return { latest, trends: trendsBody.trends ?? [] };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export default async function AdminEvalsPage() {
  const data = await fetchEvals();

  if ('error' in data) {
    return (
      <div style={{ padding: 32, color: 'var(--text-1)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Eval Dashboard</h1>
        <p style={{ color: 'var(--rust)' }}>Error: {data.error}</p>
      </div>
    );
  }

  const { latest, trends } = data;

  const byProvider = new Map<string, EvalRow[]>();
  for (const r of latest.results) {
    const arr = byProvider.get(r.provider) ?? [];
    arr.push(r);
    byProvider.set(r.provider, arr);
  }
  const providerSummary = Array.from(byProvider.entries()).map(([provider, rows]) => ({
    provider,
    model: rows[0]?.model ?? '',
    avg_score: Number((rows.reduce((s, r) => s + Number(r.score ?? 0), 0) / rows.length).toFixed(3)),
    avg_latency: Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / rows.length),
    total_cost: Number(rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0).toFixed(4)),
    failed: rows.filter((r) => r.error).length,
    count: rows.length,
  }));

  return (
    <div style={{
      padding: 32,
      maxWidth: 1100,
      margin: '0 auto',
      fontFamily: 'var(--font-ui)',
      color: 'var(--text-1)',
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Eval Dashboard</h1>
      <p style={{ color: 'var(--text-meta)', marginBottom: 32 }}>
        {latest.timestamp
          ? `Letzter Run: ${new Date(latest.timestamp).toLocaleString('de-CH')}`
          : 'Noch kein Run.'}
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Latest Run — pro Provider</h2>
      {providerSummary.length === 0 ? (
        <p style={{ color: 'var(--text-meta)', marginBottom: 32 }}>Keine Daten.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={cellStyle(true)}>Provider</th>
              <th style={cellStyle(true)}>Model</th>
              <th style={cellStyle(true)}>Avg Score</th>
              <th style={cellStyle(true)}>Avg Latency</th>
              <th style={cellStyle(true)}>Cost</th>
              <th style={cellStyle(true)}>Failed</th>
            </tr>
          </thead>
          <tbody>
            {[...providerSummary].sort((a, b) => b.avg_score - a.avg_score).map((p) => (
              <tr key={p.provider} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <td style={cellStyle(false)}>{p.provider}</td>
                <td style={cellStyle(false)}><code style={{ fontSize: 12 }}>{p.model}</code></td>
                <td style={cellStyle(false)}><ScoreBadge score={p.avg_score} /></td>
                <td style={cellStyle(false)}>{p.avg_latency}ms</td>
                <td style={cellStyle(false)}>${p.total_cost.toFixed(4)}</td>
                <td style={cellStyle(false)}>
                  {p.failed > 0
                    ? <span style={{ color: 'var(--rust)' }}>{p.failed}/{p.count}</span>
                    : '0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>30-Tage Trend (täglicher Avg Score)</h2>
      <SimpleTrendTable trends={trends} />
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 0.8 ? 'var(--moss-green)' : score >= 0.5 ? 'var(--ochre)' : 'var(--rust)';
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 6,
      background: 'transparent',
      color,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      border: `1px solid ${color}`,
    }}>{(score * 100).toFixed(0)}%</span>
  );
}

function SimpleTrendTable({ trends }: { trends: Trend[] }) {
  if (trends.length === 0) {
    return <p style={{ color: 'var(--text-meta)' }}>Noch keine Trend-Daten.</p>;
  }

  const days = Array.from(new Set(trends.map((t) => t.day))).sort();
  const providers = Array.from(new Set(trends.map((t) => t.provider)));
  const matrix = new Map<string, Map<string, number>>();
  for (const t of trends) {
    if (!matrix.has(t.day)) matrix.set(t.day, new Map());
    matrix.get(t.day)!.set(t.provider, t.avg_score);
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th style={cellStyle(true)}>Tag</th>
          {providers.map((p) => <th key={p} style={cellStyle(true)}>{p}</th>)}
        </tr>
      </thead>
      <tbody>
        {days.slice(-14).map((day) => (
          <tr key={day} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
            <td style={cellStyle(false)}>{day}</td>
            {providers.map((p) => {
              const score = matrix.get(day)?.get(p);
              return (
                <td key={p} style={cellStyle(false)}>
                  {score !== undefined ? <ScoreBadge score={score} /> : '—'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cellStyle(header: boolean): React.CSSProperties {
  return {
    padding: '12px 8px',
    textAlign: 'left',
    fontSize: 14,
    fontWeight: header ? 600 : 400,
    color: header ? 'var(--text-meta)' : 'var(--text-1)',
  };
}
