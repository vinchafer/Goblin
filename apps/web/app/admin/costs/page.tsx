export const dynamic = 'force-dynamic';

import { AdminErrorState } from '@/components/admin/AdminErrorState';
import { type AdminErrorStatus } from '@/lib/admin/admin-error';

interface ProviderStat {
  provider: string;
  cost_usd: number;
  tokens: number;
  completions: number;
}

interface CostsSummary {
  period: string;
  total_cost_usd: number;
  total_completions: number;
  by_provider: ProviderStat[];
}

async function fetchSummary(): Promise<CostsSummary | { errorStatus: AdminErrorStatus; detail?: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const adminKey = process.env.ADMIN_API_KEY;
  // A missing server-side key is the same actionable cause as a 401 (the Vercel-
  // side ADMIN_API_KEY isn't set / doesn't match Railway) — surface it identically.
  if (!apiUrl) return { errorStatus: 500, detail: 'NEXT_PUBLIC_API_URL not set' };
  if (!adminKey) return { errorStatus: 401 };
  try {
    const res = await fetch(`${apiUrl}/api/admin/cost-summary`, {
      headers: { 'x-admin-key': adminKey },
      cache: 'no-store',
    });
    if (!res.ok) return { errorStatus: res.status };
    return await res.json() as CostsSummary;
  } catch {
    return { errorStatus: 'network' };
  }
}

export default async function AdminCostsPage() {
  const data = await fetchSummary();

  if ('errorStatus' in data) {
    // FW3 U5: the shared, actionable admin error state — a 401 here now names the
    // ADMIN_API_KEY cause instead of the bare "Error: API 401".
    return (
      <div style={{ padding: 32, color: 'var(--text-1)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>Cost Dashboard</h1>
        <AdminErrorState status={data.errorStatus} detail={data.detail} />
      </div>
    );
  }

  // U4c: guard the numeric renders — a partial API payload (null cost/tokens)
  // used to throw at `.toFixed`/`.toLocaleString` and blank the whole SSR page.
  const totalCost = data.total_cost_usd ?? 0;
  const avg = data.total_completions > 0
    ? (totalCost / data.total_completions).toFixed(4)
    : '—';

  return (
    <div style={{
      padding: 32,
      maxWidth: 900,
      margin: '0 auto',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-1)',
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Cost Dashboard</h1>
      <p style={{ color: 'var(--text-meta)', marginBottom: 32 }}>
        Letzte 30 Tage über alle User aggregiert.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Total Spend" value={`$${totalCost.toFixed(2)}`} />
        <StatCard label="Completions" value={String(data.total_completions)} />
        <StatCard label="Ø Cost / Completion" value={avg === '—' ? '—' : `$${avg}`} />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Pro Provider</h2>
      {data.by_provider.length === 0 ? (
        <p style={{ color: 'var(--text-meta)' }}>Keine Daten in den letzten 30 Tagen.</p>
      ) : (
        // U4c: overflow-x auto so the 4-col table scrolls on a phone.
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={cellStyle(true)}>Provider</th>
                <th style={cellStyle(true)}>Cost</th>
                <th style={cellStyle(true)}>Tokens</th>
                <th style={cellStyle(true)}>Completions</th>
              </tr>
            </thead>
            <tbody>
              {[...data.by_provider].sort((a, b) => (b.cost_usd ?? 0) - (a.cost_usd ?? 0)).map((p) => (
                <tr key={p.provider} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={cellStyle(false)}>{p.provider}</td>
                  <td style={cellStyle(false)}>${(p.cost_usd ?? 0).toFixed(4)}</td>
                  <td style={cellStyle(false)}>{(p.tokens ?? 0).toLocaleString('de-DE')}</td>
                  <td style={cellStyle(false)}>{p.completions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: '1 1 200px',
      padding: 20,
      background: 'var(--surface-1)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function cellStyle(header: boolean): React.CSSProperties {
  return {
    padding: '12px 8px',
    textAlign: 'left',
    fontSize: 'var(--t-small-fs)',
    fontWeight: header ? 600 : 400,
    color: header ? 'var(--text-meta)' : 'var(--text-1)',
  };
}
