import { createClient } from '@/lib/supabase/server';

const ENV_VARS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
  'STRIPE_PRICE_SEED',
  'STRIPE_PRICE_CRAFT',
  'STRIPE_PRICE_FORGE',
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

const ROW = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--div)' } as const;
const LABEL = { fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' } as const;
const VALUE = { fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' } as const;
const CARD = { background: 'var(--panel)', border: '1px solid var(--div)', borderRadius: 10, padding: '20px 24px', marginBottom: 20 } as const;
const H2 = { fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, color: 'var(--moss)', marginBottom: 14, letterSpacing: '-0.3px' } as const;

function Dot({ ok }: { ok: boolean }) {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#4A7C3B' : '#B85C3C', display: 'inline-block', marginRight: 6 }} />;
}

export default async function AdminHealthPage() {
  const supabase = await createClient();

  const [dbStats, apiHealth, recentErrors] = await Promise.all([
    getDbStats(supabase),
    getApiHealth(),
    getRecentErrors(supabase),
  ]);

  const webCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local';
  const webVersion = process.env.npm_package_version || '—';

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24 }}>
        Health &amp; Status
      </h1>

      {/* API + Web */}
      <div style={CARD}>
        <h2 style={H2}>Services</h2>
        <div style={ROW}>
          <span style={LABEL}>API</span>
          <span style={VALUE}>
            <Dot ok={!!apiHealth} />
            {apiHealth ? `v${apiHealth.version ?? '?'} · ${(apiHealth.gitCommit ?? 'unknown').slice(0, 7)}` : 'Unreachable'}
          </span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>Web</span>
          <span style={VALUE}>
            <Dot ok={true} />
            v{webVersion} · {webCommit.slice(0, 7)}
          </span>
        </div>
        {apiHealth?.gitCommit && webCommit !== 'local' && (
          <div style={{ marginTop: 10, fontSize: 12, color: apiHealth.gitCommit.slice(0, 7) === webCommit.slice(0, 7) ? '#4A7C3B' : '#B85C3C', fontFamily: 'DM Sans, sans-serif' }}>
            {apiHealth.gitCommit.slice(0, 7) === webCommit.slice(0, 7)
              ? 'Commits in sync'
              : `Commits differ — API: ${apiHealth.gitCommit.slice(0, 7)}, Web: ${webCommit.slice(0, 7)}`}
          </div>
        )}
      </div>

      {/* DB Stats */}
      <div style={CARD}>
        <h2 style={H2}>Database</h2>
        {([['Users', dbStats.users], ['Projects', dbStats.projects], ['Chat messages', dbStats.messages]] as [string, number][]).map(([label, count]) => (
          <div key={label} style={ROW}>
            <span style={LABEL}>{label}</span>
            <span style={VALUE}>{count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Env Vars */}
      <div style={CARD}>
        <h2 style={H2}>Environment Variables</h2>
        {ENV_VARS.map(v => {
          const set = !!process.env[v];
          return (
            <div key={v} style={ROW}>
              <span style={{ ...LABEL, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{v}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: set ? '#4A7C3B' : '#B85C3C', fontFamily: 'DM Sans, sans-serif' }}>
                <Dot ok={set} />{set ? 'Set' : 'Missing'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Recent Errors */}
      <div style={CARD}>
        <h2 style={H2}>Recent Errors (agent_runs)</h2>
        {recentErrors.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--meta)', fontStyle: 'italic' }}>No failed runs.</p>
        ) : (
          recentErrors.map((r: { id: string; status: string; error_message?: string | null; created_at: string }) => (
            <div key={r.id} style={{ ...ROW, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(184,92,60,0.1)', color: '#B85C3C', padding: '1px 6px', borderRadius: 3, fontFamily: 'DM Sans, sans-serif' }}>FAILED</span>
                <span style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              {r.error_message && (
                <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', background: 'var(--subtle)', borderRadius: 4, padding: '4px 8px', width: '100%' }}>
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
