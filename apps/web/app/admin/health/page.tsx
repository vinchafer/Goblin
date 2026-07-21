import { createClient } from '@/lib/supabase/server';
import { settle } from '@/lib/admin/settle';

export const dynamic = 'force-dynamic';

const ENV_VARS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
  'STRIPE_PRICE_BUILD_TIER1',
  'STRIPE_PRICE_PRO_TIER1',
  'STRIPE_PRICE_POWER_TIER1',
  'ADMIN_API_KEY',
  'GOOGLE_FREE_API_KEY',
  'GROQ_FREE_API_KEY',
];

async function getDbStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [users, projects, messages] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
  ]);
  return {
    users: users.count ?? 0,
    projects: projects.count ?? 0,
    messages: messages.count ?? 0,
  };
}

async function getApiHealth() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl}/version`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return await res.json() as { version?: string; gitCommit?: string; buildTime?: string; env?: string };
  } catch {
    return null;
  }
}

async function getRecentErrors(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('agent_runs')
    .select('id, status, error_message, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);
  return data ?? [];
}

async function getTrialStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const now = new Date().toISOString();
  const [active, expired, converted] = await Promise.all([
    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .not('cloud_trial_started_at', 'is', null)
      .gt('cloud_trial_ends_at', now)
      .neq('plan', 'pro'),
    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .not('cloud_trial_started_at', 'is', null)
      .lt('cloud_trial_ends_at', now)
      .neq('plan', 'pro'),
    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .not('cloud_trial_started_at', 'is', null)
      .eq('plan', 'pro'),
  ]);
  return {
    active: active.count ?? 0,
    expired: expired.count ?? 0,
    converted: converted.count ?? 0,
  };
}

const ROW = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--div)' } as const;
const LABEL = { fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' } as const;
const VALUE = { fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' } as const;
const CARD = { background: 'var(--panel)', border: '1px solid var(--div)', borderRadius: 10, padding: '20px 24px', marginBottom: 20 } as const;
const H2 = { fontFamily: 'var(--font-sans)', fontSize: 'var(--t-body-fs)', fontWeight: 700, color: 'var(--brand-green)', marginBottom: 14, letterSpacing: '-0.3px' } as const;

function Dot({ ok }: { ok: boolean }) {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', display: 'inline-block', marginRight: 6 }} />;
}

type RecentError = { id: string; status: string; error_message?: string | null; created_at: string };

export default async function AdminHealthPage() {
  const supabase = await createClient();

  // U5.5: settle every fetch so one failing query can't reject the whole
  // Promise.all and crash SSR. A failed section degrades to an honest
  // "unavailable" note instead of blanking the page.
  const [dbStats, apiHealth, recentErrors, trialStats] = await Promise.all([
    settle(() => getDbStats(supabase), { users: 0, projects: 0, messages: 0 }),
    settle(() => getApiHealth(), null),
    settle(() => getRecentErrors(supabase), [] as RecentError[]),
    settle(() => getTrialStats(supabase), { active: 0, expired: 0, converted: 0 }),
  ]);

  const db = dbStats.data;
  const api = apiHealth.data;
  const errors = recentErrors.data;
  const trials = trialStats.data;

  const webCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local';
  const webVersion = process.env.npm_package_version || '—';
  const UNAVAIL = { marginTop: 4, fontSize: 'var(--t-caption-fs)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontStyle: 'italic' } as const;

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24 }}>
        Health &amp; Status
      </h1>

      {/* API + Web */}
      <div style={CARD}>
        <h2 style={H2}>Services</h2>
        <div style={ROW}>
          <span style={LABEL}>API</span>
          <span style={VALUE}>
            <Dot ok={!!api} />
            {api ? `v${api.version ?? '?'} · ${(api.gitCommit ?? 'unknown').slice(0, 7)}` : 'Unreachable'}
          </span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>Web</span>
          <span style={VALUE}>
            <Dot ok={true} />
            v{webVersion} · {webCommit.slice(0, 7)}
          </span>
        </div>
        {api?.gitCommit && webCommit !== 'local' && (() => {
          // FW3 U5: differing SHAs are NORMAL, not an incident — a web-only wave
          // ships a new web commit while the API binary is unchanged. Rendering it
          // in red (--danger) read as an alarm for an expected state (a false
          // signal). In sync → calm success; differing → neutral META info with a
          // one-line reason, never red.
          const inSync = api.gitCommit.slice(0, 7) === webCommit.slice(0, 7);
          return (
            <div style={{ marginTop: 10, fontSize: 'var(--t-caption-fs)', color: inSync ? 'var(--success)' : 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
              {inSync
                ? 'Commits in sync'
                : `Web ${webCommit.slice(0, 7)} · API ${api.gitCommit.slice(0, 7)} — unterschiedliche Commits sind bei einem reinen Web-Deploy normal (API-Binary unverändert).`}
            </div>
          );
        })()}
      </div>

      {/* DB Stats */}
      <div style={CARD}>
        <h2 style={H2}>Database</h2>
        {([['Users', db.users], ['Projects', db.projects], ['Chat messages', db.messages]] as [string, number][]).map(([label, count]) => (
          <div key={label} style={ROW}>
            <span style={LABEL}>{label}</span>
            <span style={VALUE}>{dbStats.ok ? count.toLocaleString() : '—'}</span>
          </div>
        ))}
        {!dbStats.ok && <div style={UNAVAIL}>Database stats unavailable — the query failed. Counts shown as —.</div>}
      </div>

      {/* Trial Stats */}
      <div style={CARD}>
        <h2 style={H2}>Trial Funnel</h2>
        <div style={ROW}>
          <span style={LABEL}>Active trials</span>
          <span style={{ ...VALUE, color: 'var(--brand-green)' }}>{trialStats.ok ? trials.active.toLocaleString() : '—'}</span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>Expired (not converted)</span>
          <span style={{ ...VALUE, color: 'var(--meta)' }}>{trialStats.ok ? trials.expired.toLocaleString() : '—'}</span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>Converted to Pro</span>
          <span style={{ ...VALUE, color: 'var(--success)' }}>{trialStats.ok ? trials.converted.toLocaleString() : '—'}</span>
        </div>
        {trialStats.ok && (trials.expired + trials.converted) > 0 && (
          <div style={{ marginTop: 10, fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
            Conversion rate: {Math.round(trials.converted / (trials.expired + trials.converted) * 100)}%
          </div>
        )}
        {!trialStats.ok && <div style={UNAVAIL}>Trial funnel unavailable — the query failed.</div>}
      </div>

      {/* Env Vars */}
      <div style={CARD}>
        <h2 style={H2}>Environment Variables</h2>
        {ENV_VARS.map(v => {
          const set = !!process.env[v];
          return (
            <div key={v} style={ROW}>
              <span style={{ ...LABEL, fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)' }}>{v}</span>
              <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: set ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
                <Dot ok={set} />{set ? 'Set' : 'Missing'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Recent Errors */}
      <div style={CARD}>
        <h2 style={H2}>Recent Errors (agent_runs)</h2>
        {!recentErrors.ok ? (
          <p style={UNAVAIL}>Recent errors unavailable — the query failed.</p>
        ) : errors.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--meta)', fontStyle: 'italic' }}>No failed runs.</p>
        ) : (
          errors.map((r: RecentError) => (
            <div key={r.id} style={{ ...ROW, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(184,92,60,0.1)', color: 'var(--danger)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-sans)' }}>FAILED</span>
                <span style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              {r.error_message && (
                <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', background: 'var(--subtle)', borderRadius: 4, padding: '4px 8px', width: '100%' }}>
                  {r.error_message.slice(0, 200)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
