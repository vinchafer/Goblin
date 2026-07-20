'use client';

// Session 4 — /admin/telemetry: the FOUNDER's read-only Layer-1 operating view.
// Gated by the admin layout (session is_admin / ADMIN_EMAIL) + the /api/admin proxy
// (injects the admin key server-side). Reads GET /api/admin/telemetry only — no
// mutation. NEVER renders a provider name or model slug; the estimated $ shown here
// is the founder's own operating data (HR-2/HR-3). Legible at 390px (iPhone).

import { useCallback, useEffect, useState } from 'react';

const ADMIN_BASE = '/api/admin';

interface UserRollup {
  userId: string;
  plan: string;
  swiftTokens: number;
  forgeTokens: number;
  tokens: number;
  weightedUnits: number;
  completions: number;
  zeroTokenCompletions: number;
  estimatedCostUsd: number;
}
interface Telemetry {
  calibrated: boolean;
  month: string;
  resetDate: string;
  totalSwiftTokens: number;
  totalForgeTokens: number;
  totalTokens: number;
  weightedCostUnits: number;
  estimatedCostUsd: number;
  activeUsers: number;
  completions: number;
  zeroTokenCompletions: number;
  avgTokensPerUser: number;
  planDistribution: Record<string, number>;
  topUsers: UserRollup[];
  reconciliation: {
    completionCostsTokens: number;
    telemetryTokens: number;
    capRollupUnits: number;
    telemetryRollupUnits: number;
    consistent: boolean;
  };
}

const nf = (n: number) => n.toLocaleString('en-US');
const mono = "'JetBrains Mono', monospace";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ fontSize: 12, color: 'var(--meta)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

export default function AdminTelemetryPage() {
  const [data, setData] = useState<Telemetry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_BASE}/telemetry`, { headers: { 'Content-Type': 'application/json' } });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: 'var(--meta)' }}>Loading…</div>;
  if (!data) return <div style={{ color: 'var(--danger)' }}>Could not load telemetry data.</div>;

  const r = data.reconciliation;
  const reconciled = r.consistent;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px', margin: 0 }}>
          Goblin Telemetry
        </h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-gold-ink, #7A5A12)', background: 'var(--brand-gold)', borderRadius: 999, padding: '3px 10px' }}>
          live · not yet calibrated
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>
        This calendar month · resets {data.resetDate}
      </div>

      {/* Reconciliation — the 1000% guarantee, surfaced first */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        background: 'var(--panel)', border: `1px solid ${reconciled ? 'var(--success, #1A3A2A)' : 'var(--danger)'}`,
        borderRadius: 12, padding: '12px 16px',
      }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: reconciled ? 'var(--success, #1A3A2A)' : 'var(--danger)', flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          <strong style={{ color: reconciled ? 'var(--brand-green)' : 'var(--danger)' }}>
            {reconciled ? 'Reconciled' : 'DIVERGENCE'}
          </strong>{' '}
          — cap rollup {nf(r.capRollupUnits)} units = telemetry {nf(r.telemetryRollupUnits)} units;
          tokens {nf(r.completionCostsTokens)} = {nf(r.telemetryTokens)}.
          {reconciled ? ' The number the user sees equals the spend you pay.' : ' Tracking drift — investigate.'}
        </div>
      </div>

      <Card title="This month">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, rowGap: 18 }}>
          <Stat label="Total tokens" value={nf(data.totalTokens)} sub={`${nf(data.totalSwiftTokens)} Swift · ${nf(data.totalForgeTokens)} Forge`} />
          <Stat label="Weighted cost units" value={nf(data.weightedCostUnits)} sub="Swift + Forge ×4.4" />
          <Stat label="Est. spend (you)" value={`$${(data.estimatedCostUsd ?? 0).toFixed(4)}`} sub="wholesale, founder-only" />
          <Stat label="Active users" value={nf(data.activeUsers)} />
          <Stat label="Avg tokens / user" value={nf(data.avgTokensPerUser)} />
          <Stat label="Completions" value={nf(data.completions)} sub={`${nf(data.zeroTokenCompletions)} zero-token (flagged)`} />
        </div>
      </Card>

      <Card title="Plan distribution (active users)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {(['trial', 'build', 'pro', 'power', 'other'] as const).map((p) => (
            <div key={p} style={{ flex: '1 1 90px', minWidth: 90 }}>
              <div style={{ fontSize: 12, color: 'var(--meta)', textTransform: 'capitalize' }}>{p}</div>
              <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{nf(data.planDistribution[p] ?? 0)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Heaviest users (the forming tail · by id, no PII)">
        {data.topUsers.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--meta)' }}>No Goblin-hosted usage yet this month.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--div, var(--border))' }}>
                  {['User', 'Plan', 'Swift', 'Forge', 'Units', 'Calls'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'User' || h === 'Plan' ? 'left' : 'right', padding: '6px 10px', color: 'var(--meta)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: '1px solid var(--div, var(--border))' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text)', fontFamily: mono }}>{u.userId.slice(0, 8)}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text)', textTransform: 'capitalize' }}>{u.plan}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text)', textAlign: 'right', fontFamily: mono }}>{nf(u.swiftTokens)}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text)', textAlign: 'right', fontFamily: mono }}>{nf(u.forgeTokens)}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--brand-green)', textAlign: 'right', fontFamily: mono, fontWeight: 700 }}>{nf(u.weightedUnits)}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--meta)', textAlign: 'right', fontFamily: mono }}>{nf(u.completions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
