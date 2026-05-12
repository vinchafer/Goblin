'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

interface UsageData {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  daysUntilReset: number | null;
  period: string;
  totalInPeriod: number;
  byTier: { byok: number; free_api: number; goblin_hosted: number };
  byModel: Array<{ model: string; count: number }>;
  byProject: Array<{ projectId: string; name: string; count: number }>;
}

type Period = '7d' | '30d' | '90d';

const TIER_LABELS: Record<string, string> = {
  byok: 'Your Keys (BYOK)',
  free_api: 'Free API Pool',
  goblin_hosted: 'Goblin Hosted',
};

const TIER_COLORS: Record<string, string> = {
  byok: 'var(--moss)',
  free_api: 'var(--ochre)',
  goblin_hosted: '#3A6B8A',
};

function PlanBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct > 85 ? 'var(--danger)' : pct > 60 ? 'var(--ochre)' : 'var(--moss)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
          {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'} requests
        </span>
        <span style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
          {pct}% used
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--div)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function TierBar({ byTier, total }: { byTier: UsageData['byTier']; total: number }) {
  if (total === 0) return (
    <div style={{ fontSize: 12, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif', padding: '8px 0' }}>
      No requests in this period.
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
        {(['byok', 'free_api', 'goblin_hosted'] as const).map(tier => {
          const pct = total > 0 ? (byTier[tier] / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div key={tier} style={{ width: `${pct}%`, background: TIER_COLORS[tier], transition: 'width 0.4s ease' }} title={`${TIER_LABELS[tier]}: ${byTier[tier]}`} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {(['byok', 'free_api', 'goblin_hosted'] as const).map(tier => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: TIER_COLORS[tier], flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
              {TIER_LABELS[tier]}: {byTier[tier]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E8E4DC',
      borderRadius: 12,
      padding: '20px 22px',
      marginBottom: 16,
    }}>
      <div style={{ marginBottom: subtitle ? 4 : 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif', marginTop: 2, marginBottom: 16 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    setLoading(true);
    apiGet<UsageData>(`/api/users/me/usage?period=${period}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  const periodLabel: Record<Period, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', margin: 0, marginBottom: 4 }}>
            Usage
          </h1>
          <p style={{ fontSize: 13, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
            Track your AI request usage across all sessions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: period === p ? '2px solid #2D4A2B' : '1px solid #E8E4DC',
                background: period === p ? 'rgba(45,74,43,0.08)' : '#fff',
                color: period === p ? 'var(--moss)' : 'var(--meta)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[180, 120, 120, 100].map((h, i) => (
            <div key={i} style={{ height: h, background: 'var(--cream)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: '#FDF2EE', border: '1px solid rgba(184,92,60,0.3)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif' }}>
          Couldn&apos;t load usage data. Check your connection.
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Hero: plan cycle */}
          <Section title="This Billing Cycle" subtitle={data.daysUntilReset !== null ? `${data.daysUntilReset} days until reset` : undefined}>
            <PlanBar used={data.monthlyUsed} limit={data.monthlyLimit} />
            <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
              <Stat label="Plan" value={data.plan.charAt(0).toUpperCase() + data.plan.slice(1)} />
              <Stat label="Used this cycle" value={data.monthlyUsed.toString()} />
              {data.monthlyLimit > 0 && <Stat label="Limit" value={data.monthlyLimit.toString()} />}
              {data.daysUntilReset !== null && <Stat label="Days until reset" value={data.daysUntilReset.toString()} />}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0ECE4', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
                BYOK requests don&apos;t count toward your plan limit.
              </span>
            </div>
          </Section>

          {/* By tier */}
          <Section title={`By Provider — ${periodLabel[period]}`} subtitle={`${data.totalInPeriod} total requests`}>
            <TierBar byTier={data.byTier} total={data.totalInPeriod} />
          </Section>

          {/* By model */}
          <Section title="Top Models">
            {data.byModel.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif' }}>No data yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.byModel.map(({ model, count }) => (
                  <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      flex: 1, height: 28, background: 'var(--cream)', borderRadius: 6, overflow: 'hidden', position: 'relative',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${data.totalInPeriod > 0 ? Math.round((count / data.totalInPeriod) * 100) : 0}%`,
                        background: 'rgba(45,74,43,0.15)',
                        borderRadius: 6,
                        transition: 'width 0.4s ease',
                      }} />
                      <span style={{
                        position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 12, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                      }}>
                        {model.split('/').pop() ?? model}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* By project */}
          {data.byProject.length > 0 && (
            <Section title="Top Projects">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.byProject.map(({ projectId, name, count }) => (
                  <div key={projectId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--cream)', borderRadius: 7 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>{name}</span>
                    <span style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>{count} requests</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Routing settings link */}
          <div style={{
            background: 'var(--cream)', border: '1px solid #E8E4DC',
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>
                Auto-Fallback Routing
              </div>
              <div style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
                Configure which provider Goblin switches to when you hit rate limits.
              </div>
            </div>
            <a
              href="/dashboard/settings/routing"
              style={{
                flexShrink: 0, padding: '7px 14px',
                background: 'var(--moss)', color: '#fff',
                borderRadius: 7, fontSize: 12, fontWeight: 600,
                fontFamily: 'DM Sans, sans-serif', textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Configure →
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--disabled)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>
        {value}
      </div>
    </div>
  );
}
