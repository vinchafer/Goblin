import { Suspense } from 'react';

interface Check {
  status: 'ok' | 'fail' | 'skip' | 'degraded';
  latencyMs?: number;
}

interface HealthData {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, Check>;
}

async function getHealth(): Promise<HealthData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/health/deep`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'ok' ? '#4a7c3b' : status === 'degraded' || status === 'skip' ? '#D4A94A' : '#b85c3c';
  return (
    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const SERVICE_LABELS: Record<string, string> = {
  supabase: 'Database (Supabase)',
  storage: 'File Storage',
  litellm: 'AI Proxy (LiteLLM)',
  stripe: 'Payments (Stripe)',
};

export default async function StatusPage() {
  const health = await getHealth();

  const overall = health?.status ?? 'down';
  const overallColor = overall === 'ok' ? '#4a7c3b' : overall === 'degraded' ? '#D4A94A' : '#b85c3c';
  const overallLabel = overall === 'ok' ? '✓ All systems operational' : overall === 'degraded' ? '⚠ Partial outage' : '✗ Major outage';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'var(--moss)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>👺</span>
        <a href="/" style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: 'var(--ochre)', textDecoration: 'none' }}>Goblin</a>
        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontSize: 13 }}>/ Status</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        {/* Overall status */}
        <div style={{
          background: '#fff', border: `2px solid ${overallColor}`, borderRadius: 14,
          padding: '24px 28px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <StatusDot status={overall} />
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{overallLabel}</div>
            {health && (
              <div style={{ fontSize: 12, color: 'var(--meta)', marginTop: 4 }}>
                Uptime: {formatUptime(health.uptime)} · v{health.version} · Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Service checks */}
        <div style={{ background: '#fff', border: '1px solid var(--div)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--div)', fontSize: 12, fontWeight: 600, color: 'var(--meta)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Services
          </div>
          {health ? (
            Object.entries(health.checks).map(([key, check]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--div)', gap: 12 }}>
                <StatusDot status={check.status} />
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{SERVICE_LABELS[key] ?? key}</span>
                <span style={{ fontSize: 12, color: 'var(--meta)' }}>
                  {check.status === 'skip' ? 'Not configured' : check.status === 'ok' ? 'Operational' : check.status === 'fail' ? 'Unavailable' : 'Degraded'}
                  {check.latencyMs != null && check.status === 'ok' && ` · ${check.latencyMs}ms`}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '20px', fontSize: 13, color: 'var(--meta)', textAlign: 'center' }}>Unable to fetch service status</div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--meta)', textAlign: 'center' }}>
          Auto-refreshes every 60 seconds.{' '}
          <a href="mailto:hi@justgoblin.com" style={{ color: 'var(--ochre-dark)' }}>Report an incident →</a>
        </p>
      </div>

      <meta httpEquiv="refresh" content="60" />
    </div>
  );
}
