'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

async function authHeaders(): Promise<Record<string, string> | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

interface GithubState { connected: boolean; username?: string }
interface VercelState { connected: boolean; account?: { username: string; email?: string } }

export function ConnectorsPage() {
  const [github, setGithub] = useState<GithubState>({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        // /api/github/status returns { connected, username } directly.
        // FIX2-6 (BUG-20): hard timeout so a hung request can never leave the
        // page stuck on "Lade Konnektoren…".
        const r = await fetch(`${apiBase}/api/github/status`, { headers, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const data = await r.json() as GithubState;
          setGithub({ connected: !!data.connected, username: data.username });
        }
      } catch {
        /* network/timeout — fall through to a definite (disconnected) state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Initiate OAuth directly (one click) and return to this settings page after.
  const connectGithub = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${apiBase}/api/github/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ returnTo: '/dashboard?settings=connectors' }),
      });
      if (r.ok) {
        const { url } = await r.json() as { url: string };
        if (url) window.location.href = url;
      }
    } catch {
      /* swallow — button stays clickable */
    }
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>Lade Konnektoren...</div>;

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Versionskontrolle">
        <SettingsCard>
          <ConnectorRow
            name="GitHub"
            initial="GH"
            connected={github.connected}
            detail={github.connected ? `@${github.username}` : 'Repos pushen, deployen'}
            onConnect={() => { void connectGithub(); }}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Deploy-Plattformen">
        <SettingsCard>
          <VercelConnectorRow />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="Weitere Integrationen">
        <SettingsCard>
          <MoreIntegrations />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

// Compact, deliberate roll-up of the integrations still on the roadmap — one
// element instead of ~20 muted "Bald verfügbar" rows that read like vapor.
function MoreIntegrations() {
  const upcoming = [
    'GitLab', 'Bitbucket', 'Netlify', 'Railway', 'Fly.io', 'Cloudflare',
    'Supabase', 'Firebase', 'PlanetScale', 'Neon', 'Slack', 'Discord',
    'Telegram', 'Notion', 'Linear', 'Figma', 'PostHog', 'Plausible', 'Google Analytics',
  ];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-meta)', marginBottom: 12, lineHeight: 1.5 }}>
        GitHub und Vercel funktionieren heute schon. Diese Integrationen folgen nach und nach:
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {upcoming.map((name) => (
          <span key={name} style={{
            padding: '4px 10px', borderRadius: 999, background: 'var(--subtle)',
            color: 'var(--text-meta)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
          }}>{name}</span>
        ))}
      </div>
    </div>
  );
}

function VercelConnectorRow() {
  const [state, setState] = useState<VercelState>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) { setLoading(false); return; }
    try {
      // FIX2-6 (BUG-20): hard timeout so the Vercel subtitle can never stick on
      // "Lade…" when the request hangs (CORS preflight, dead API, slow network).
      const r = await fetch(`${apiBase}/api/integrations/vercel`, { headers, signal: AbortSignal.timeout(8000) });
      if (r.ok) setState(await r.json());
    } catch {
      /* network/timeout — leave state as disconnected, never an infinite spinner */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    if (!token.trim()) { setError('Bitte Token einfügen'); return; }
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) { setError('Nicht angemeldet'); return; }
      const r = await fetch(`${apiBase}/api/integrations/vercel`, {
        method: 'POST', headers, body: JSON.stringify({ token: token.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error ?? 'Verbindung fehlgeschlagen'); return; }
      setState({ connected: true, account: data.account });
      setShowForm(false); setToken('');
    } catch {
      setError('Verbindung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }, [token]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(`${apiBase}/api/integrations/vercel`, { method: 'DELETE', headers });
      setState({ connected: false });
    } finally {
      setBusy(false);
    }
  }, []);

  const detail = loading
    ? 'Lade…'
    : state.connected
      ? (state.account?.username ?? 'verbunden')
      : 'Automatisches Deploy mit deinem Vercel-Token';

  return (
    <div style={{ borderBottom: '1px solid var(--border-hairline)' }}>
      <div className="list-item" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, background: 'var(--subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--meta)', fontFamily: 'var(--font-mono)',
        }}>V</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Vercel</div>
          <div style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
        </div>
        {state.connected ? (
          <button onClick={disconnect} disabled={busy} style={ghostBtn('var(--text-meta)')}>
            {busy ? '…' : 'Trennen'}
          </button>
        ) : (
          <button onClick={() => { setShowForm((s) => !s); setError(null); }} disabled={loading} style={ghostBtn('var(--brand-green)')}>
            {showForm ? 'Abbrechen' : 'Token einfügen'}
          </button>
        )}
      </div>

      <div style={{ padding: '0 16px 12px', marginTop: -4 }}>
        <span style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-meta)', lineHeight: 1.45 }}>
          Goblin pusht in deinen eigenen Vercel-Account. Deine Deployments, deine Kosten.
          {state.connected && ' Dein veröffentlichtes Projekt ist öffentlich erreichbar.'}
        </span>
      </div>

      {showForm && !state.connected && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Vercel-Token (vercel.com → Settings → Tokens)"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)',
            }}
          />
          {error && <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--danger)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={connect} disabled={busy} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--brand-green)', color: 'var(--on-brand, #fff)',
              fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)', opacity: busy ? 0.7 : 1,
            }}>
              {busy ? 'Prüfe…' : 'Verbinden'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-meta)' }}>
            Wird gegen die Vercel-API geprüft und verschlüsselt gespeichert. Nur Account-Ebene.
          </div>
        </div>
      )}
    </div>
  );
}

function ghostBtn(color: string): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8,
    background: 'transparent', border: `1px solid ${color}`,
    color, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  };
}

function ConnectorRow({ name, initial, connected, detail, onConnect, disabled }: {
  name: string; initial: string; connected: boolean; detail: string; onConnect?: () => void; disabled?: boolean;
}) {
  return (
    <div className="list-item" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-hairline)' }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: 'var(--subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--meta)', fontFamily: 'var(--font-mono)',
      }}>{initial}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 2 }}>{detail}</div>
      </div>
      {connected ? (
        <span style={{ padding: '4px 10px', borderRadius: 12, background: 'color-mix(in srgb, var(--brand-green) 8%, transparent)', color: 'var(--brand-green)', fontSize: 'var(--t-caption-fs)', fontWeight: 600 }}>
          Verbunden
        </span>
      ) : (
        <button onClick={onConnect} disabled={disabled} style={{
          padding: '6px 12px', borderRadius: 8,
          background: 'transparent', border: '1px solid var(--brand-green)',
          color: 'var(--brand-green)', fontSize: 13, fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'var(--font-sans)',
        }}>
          {disabled ? 'Bald' : 'Verbinden'}
        </button>
      )}
    </div>
  );
}
