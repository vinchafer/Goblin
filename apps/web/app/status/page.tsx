import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface VersionData {
  version: string;
  gitCommit: string;
  buildTime: string;
  nodeEnv?: string;
  env?: string;
  apiUrl?: string;
  webReady?: boolean;
  apiReady?: boolean;
}

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

interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  description: string | null;
  resolved_at: string | null;
  created_at: string;
}

async function getWebVersion(): Promise<VersionData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/version`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getApiVersion(): Promise<VersionData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/version`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getHealth(): Promise<HealthData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/health/deep`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getIncidents(): Promise<Incident[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('incidents')
      .select('id, title, status, severity, description, resolved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'ok' ? 'var(--success)' : status === 'degraded' || status === 'skip' ? 'var(--ochre)' : 'var(--danger)';
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

const INCIDENT_STATUS_COLOR: Record<string, string> = {
  investigating: 'var(--danger)',
  identified:    'var(--ochre)',
  monitoring:    '#3A6B8A',
  resolved:      'var(--success)',
};

const SEVERITY_ICON: Record<string, string> = {
  minor: '🟡', major: '🟠', critical: '🔴',
};

export default async function StatusPage() {
  const [health, incidents, webVersion, apiVersion] = await Promise.all([
    getHealth(), getIncidents(), getWebVersion(), getApiVersion(),
  ]);

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  const overall = health?.status ?? 'down';
  const overallColor = overall === 'ok' ? 'var(--success)' : overall === 'degraded' ? 'var(--ochre)' : 'var(--danger)';
  const overallLabel = overall === 'ok'
    ? activeIncidents.length > 0 ? '⚠ Active incidents' : '✓ All systems operational'
    : overall === 'degraded' ? '⚠ Partial outage' : '✗ Major outage';

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
          background: 'var(--panel)', border: `2px solid ${overallColor}`, borderRadius: 14,
          padding: '24px 28px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <StatusDot status={activeIncidents.length > 0 ? 'degraded' : overall} />
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{overallLabel}</div>
            {health && (
              <div style={{ fontSize: 12, color: 'var(--meta)', marginTop: 4 }}>
                Uptime: {formatUptime(health.uptime)} · v{health.version} · Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Active Incidents
            </div>
            {activeIncidents.map(inc => (
              <div key={inc.id} style={{
                background: 'var(--panel)', border: '1px solid rgba(184,92,60,0.3)',
                borderLeft: `3px solid ${INCIDENT_STATUS_COLOR[inc.status] || 'var(--danger)'}`,
                borderRadius: 10, padding: '14px 18px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span>{SEVERITY_ICON[inc.severity] || '🟡'}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{inc.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: INCIDENT_STATUS_COLOR[inc.status] || 'var(--meta)' }}>
                    {inc.status}
                  </span>
                </div>
                {inc.description && (
                  <div style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.5 }}>{inc.description}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                  {new Date(inc.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service checks */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--div)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
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

        {/* Incident history */}
        {resolvedIncidents.length > 0 && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--div)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--div)', fontSize: 12, fontWeight: 600, color: 'var(--meta)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Past Incidents
            </div>
            {resolvedIncidents.map(inc => (
              <div key={inc.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--div)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, marginTop: 2 }}>{SEVERITY_ICON[inc.severity] || '🟡'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{inc.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 2 }}>{new Date(inc.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'rgba(74,124,59,0.1)', padding: '2px 7px', borderRadius: 4 }}>
                  Resolved
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Deployment versions */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--div)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--div)', fontSize: 12, fontWeight: 600, color: 'var(--meta)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Deployment
          </div>
          {[
            { label: 'Web (Vercel)', data: webVersion },
            { label: 'API (Railway)', data: apiVersion },
          ].map(({ label, data }) => (
            <div key={label} style={{ padding: '14px 20px', borderBottom: '1px solid var(--div)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <StatusDot status={data ? 'ok' : 'fail'} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'monospace', color: 'var(--meta)' }}>
                  {data ? `v${data.version}` : 'unreachable'}
                </span>
              </div>
              {data && (
                <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace', paddingLeft: 20 }}>
                  commit: {data.gitCommit.slice(0, 7)} · built: {new Date(data.buildTime).toLocaleString()}
                </div>
              )}
            </div>
          ))}
          {webVersion && apiVersion && webVersion.gitCommit !== 'unknown' && apiVersion.gitCommit !== 'unknown' && (
            <div style={{ padding: '10px 20px', fontSize: 12, color: webVersion.gitCommit === apiVersion.gitCommit ? 'var(--success)' : 'var(--ochre)', fontWeight: 600 }}>
              {webVersion.gitCommit === apiVersion.gitCommit ? '✓ Web and API on same commit' : '⚠ Web and API on different commits'}
            </div>
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
