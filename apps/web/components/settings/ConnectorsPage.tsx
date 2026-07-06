'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { useLang, t } from '@/lib/use-lang';

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
  const lang = useLang();
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

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>{t(lang, 'Lade Konnektoren...', 'Loading connectors...')}</div>;

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label={t(lang, 'Versionskontrolle', 'Version control')}>
        <SettingsCard>
          <ConnectorRow
            name="GitHub"
            initial="GH"
            connected={github.connected}
            detail={github.connected ? `@${github.username}` : t(lang, 'Dein Code als echtes Git-Repo', 'Your code as a real Git repo')}
            onConnect={() => { void connectGithub(); }}
          />
          {!github.connected && (
            <ConnectorHelp
              what={t(lang,
                'Goblin legt deinen Code als echtes Git-Repository auf GitHub ab — mit Versionsverlauf, Backup und der Basis, um mit anderen zusammenzuarbeiten.',
                'Goblin puts your code on GitHub as a real Git repository — version history, backup, and the basis for collaborating with others.')}
              steps={[
                t(lang, 'Auf „Verbinden" tippen', 'Tap "Connect"'),
                t(lang, 'Bei GitHub anmelden und Goblin bestätigen', 'Sign in to GitHub and confirm Goblin'),
              ]}
              eta={t(lang, '~1 Minute', '~1 minute')}
            />
          )}
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Deploy-Plattformen', 'Deploy platforms')}>
        <SettingsCard>
          <VercelConnectorRow />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label={t(lang, 'Bald verfügbar', 'Coming soon')}>
        <SettingsCard>
          <SoonSection />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

// P1.9: a plain-language "what this does for you + the 2-3 steps" block, shown
// under an active (connectable) connector so the page explains itself.
function ConnectorHelp({ what, steps, eta }: { what: string; steps: string[]; eta?: string }) {
  const lang = useLang();
  return (
    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{what}</p>
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ fontSize: 12.5, color: 'var(--text-meta)', lineHeight: 1.5 }}>{s}</li>
        ))}
      </ol>
      {eta && (
        <span style={{ fontSize: 11.5, color: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>
          {t(lang, 'Dauer', 'Takes')}: {eta}
        </span>
      )}
    </div>
  );
}

// P1.9: honest roadmap. House rule — visible "Bald" cards with NO clickable fake
// affordance (no button, not focusable). Founder-picked plausible set from the
// FEEL-4 planning: Supabase (DB & auth), Stripe (payments), own domain. Each
// says plainly what it will do; none pretends to be actionable yet.
function SoonSection() {
  const lang = useLang();
  const soon = [
    {
      name: 'Supabase', initial: 'SB',
      blurb: t(lang, 'Datenbank & Login für deine App — damit sich Nutzer anmelden und ihre Daten gespeichert werden.', 'Database & login for your app — so users can sign in and their data is stored.'),
    },
    {
      name: 'Stripe', initial: 'ST',
      blurb: t(lang, 'Zahlungen annehmen — Abos oder einmalige Käufe direkt in deinem Projekt.', 'Accept payments — subscriptions or one-off purchases right inside your project.'),
    },
    {
      name: t(lang, 'Eigene Domain', 'Custom domain'), initial: 'WWW',
      blurb: t(lang, 'Verbinde deine eigene Adresse (z. B. deine-marke.de) statt der Standard-URL.', 'Connect your own address (e.g. your-brand.com) instead of the default URL.'),
    },
  ];
  return (
    <div>
      {soon.map((s, i) => (
        <SoonCard key={s.name} name={s.name} initial={s.initial} blurb={s.blurb} last={i === soon.length - 1} />
      ))}
    </div>
  );
}

function SoonCard({ name, initial, blurb, last }: { name: string; initial: string; blurb: string; last?: boolean }) {
  const lang = useLang();
  return (
    // Not a button and not focusable: aria-disabled + no interactive children, so
    // it reads as a roadmap card and can never be clicked or tabbed into.
    <div
      data-testid="connector-soon"
      aria-disabled="true"
      style={{
        padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12,
        borderBottom: last ? 'none' : '1px solid var(--border-hairline)', opacity: 0.72,
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: 'var(--subtle)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--meta)', fontFamily: 'var(--font-mono)',
      }}>{initial}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
          <span style={{
            padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-gold) 16%, transparent)',
            color: 'var(--gold-800, #7E5C1B)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{t(lang, 'Bald', 'Soon')}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-meta)', marginTop: 3, lineHeight: 1.5 }}>{blurb}</div>
      </div>
    </div>
  );
}

function VercelConnectorRow() {
  const lang = useLang();
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
    if (!token.trim()) { setError(t(lang, 'Bitte Token einfügen', 'Please paste a token')); return; }
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) { setError(t(lang, 'Nicht angemeldet', 'Not signed in')); return; }
      const r = await fetch(`${apiBase}/api/integrations/vercel`, {
        method: 'POST', headers, body: JSON.stringify({ token: token.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error ?? t(lang, 'Verbindung fehlgeschlagen', 'Connection failed')); return; }
      setState({ connected: true, account: data.account });
      setShowForm(false); setToken('');
    } catch {
      setError(t(lang, 'Verbindung fehlgeschlagen', 'Connection failed'));
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
    ? t(lang, 'Lade…', 'Loading…')
    : state.connected
      ? (state.account?.username ?? t(lang, 'verbunden', 'connected'))
      : t(lang, 'Automatisches Deploy mit deinem Vercel-Token', 'Automatic deploy with your Vercel token');

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
            {busy ? '…' : t(lang, 'Trennen', 'Disconnect')}
          </button>
        ) : (
          <button onClick={() => { setShowForm((s) => !s); setError(null); }} disabled={loading} style={ghostBtn('var(--brand-green)')}>
            {showForm ? t(lang, 'Abbrechen', 'Cancel') : t(lang, 'Token einfügen', 'Add token')}
          </button>
        )}
      </div>

      <div style={{ padding: '0 16px 12px', marginTop: -4 }}>
        <span style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-meta)', lineHeight: 1.45 }}>
          {t(lang, 'Goblin pusht in deinen eigenen Vercel-Account. Deine Deployments, deine Kosten.', 'Goblin pushes to your own Vercel account. Your deployments, your cost.')}
          {state.connected && ` ${t(lang, 'Dein veröffentlichtes Projekt ist öffentlich erreichbar.', 'Your published project is publicly reachable.')}`}
        </span>
      </div>

      {!state.connected && !showForm && (
        <ConnectorHelp
          what={t(lang,
            'Deine Seite geht unter einer echten, öffentlichen Adresse online — automatisch bei jedem „Live stellen".',
            'Your site goes online at a real, public address — automatically on every "Publish".')}
          steps={[
            t(lang, 'In Vercel unter Settings → Tokens einen Token erstellen', 'In Vercel, create a token under Settings → Tokens'),
            t(lang, 'Token oben mit „Token einfügen" hinterlegen', 'Add it above with "Add token"'),
          ]}
          eta={t(lang, '~2 Minuten', '~2 minutes')}
        />
      )}

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
              {busy ? t(lang, 'Prüfe…', 'Checking…') : t(lang, 'Verbinden', 'Connect')}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-meta)' }}>
            {t(lang, 'Wird gegen die Vercel-API geprüft und verschlüsselt gespeichert. Nur Account-Ebene.', 'Validated against the Vercel API and stored encrypted. Account level only.')}
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
  const lang = useLang();
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
          {t(lang, 'Verbunden', 'Connected')}
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
          {disabled ? t(lang, 'Bald', 'Soon') : t(lang, 'Verbinden', 'Connect')}
        </button>
      )}
    </div>
  );
}
