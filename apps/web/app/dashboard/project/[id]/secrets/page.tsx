'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';

interface Secret {
  id: string;
  name: string;
  value_hint: string | null;
  environment: string;
  updated_at: string;
}

const ENVIRONMENTS = ['production', 'staging', 'development'] as const;
type Env = typeof ENVIRONMENTS[number];

// Per-secret "where do I get this" guidance. Plain-language pointers,
// nothing prescriptive. Match by exact key name first, then by prefix.
function whereDoIGetThis(name: string): string | null {
  const n = name.toUpperCase();
  if (n.startsWith('STRIPE_SECRET') || n === 'STRIPE_SK')         return 'Dashboard → Developers → API keys → "Secret key" (mit sk_live_ beginnt). Behalte den Test-Key in DEVELOPMENT/STAGING.';
  if (n.startsWith('STRIPE_WEBHOOK'))                              return 'Dashboard → Developers → Webhooks → dein Endpoint → "Signing secret" (mit whsec_ beginnt).';
  if (n.startsWith('STRIPE_'))                                     return 'Stripe-Dashboard. Test-Keys nur in DEVELOPMENT/STAGING, Live-Keys nur in PRODUCTION.';
  if (n.startsWith('DATABASE_URL') || n.startsWith('POSTGRES_'))   return 'Bei Supabase: Projekt → Settings → Database → Connection String. Bei Neon/PlanetScale ebenfalls in den Verbindungseinstellungen.';
  if (n.startsWith('RESEND_'))                                     return 'resend.com → API Keys → "Create API key". Domain vorher verifizieren.';
  if (n.startsWith('OPENAI_'))                                     return 'platform.openai.com → API Keys. Eigene Org/Projekt erstellen, dann Key. Niemals in Frontend einbetten.';
  if (n.startsWith('ANTHROPIC_'))                                  return 'console.anthropic.com → API Keys. Tip: erstelle einen Key pro Projekt.';
  if (n.startsWith('SUPABASE_SERVICE') || n === 'SUPABASE_ANON_KEY') return 'Supabase → Settings → API. Service-Key NUR auf dem Server, anon-Key kann ins Frontend.';
  if (n.startsWith('GOOGLE_') || n.startsWith('GCP_'))             return 'Google Cloud Console → APIs & Services → Credentials.';
  return null;
}

const PANEL_OUT: React.CSSProperties = {
  background: 'var(--d-surface-elev)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)', overflow: 'hidden',
};

export default function ProjectSecretsPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [env, setEnv] = useState<Env>('production');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [reauthToken, setReauthToken] = useState<string | null>(null);
  const [reauthModal, setReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [revealLoading, setRevealLoading] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchSecrets = useCallback(async (tok: string) => {
    const res = await fetch(`${apiBase}/api/projects/${projectId}/secrets?environment=${env}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (res.ok) setSecrets(await res.json());
  }, [apiBase, projectId, env]);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setToken(session.access_token);
      await fetchSecrets(session.access_token);
      setLoading(false);
    };
    init();
  }, [fetchSecrets]);

  const handleReauth = async () => {
    setReauthLoading(true);
    setReauthError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: reauthPassword,
      });
      if (error || !data.session) {
        setReauthError('Falsches Passwort.');
        return;
      }
      setReauthToken(data.session.access_token);
      setReauthModal(false);
      setReauthPassword('');
    } finally {
      setReauthLoading(false);
    }
  };

  const handleReveal = async (secretId: string) => {
    if (!reauthToken) { setReauthModal(true); return; }
    setRevealLoading(secretId);
    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/secrets/${secretId}/reveal`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Reauth-Token': reauthToken },
      });
      if (res.status === 401) {
        setReauthToken(null); setReauthModal(true); return;
      }
      if (res.ok) {
        const d = await res.json();
        setRevealedValues(prev => ({ ...prev, [secretId]: d.value }));
      }
    } finally { setRevealLoading(null); }
  };

  const handleAdd = async () => {
    if (!token || !newName || !newValue) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.toUpperCase().replace(/\s/g, '_'), value: newValue, environment: env }),
      });
      if (res.ok) {
        setAddModal(false); setNewName(''); setNewValue('');
        await fetchSecrets(token);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (secretId: string) => {
    if (!token || !confirm('Diesen Secret wirklich löschen?')) return;
    await fetch(`${apiBase}/api/projects/${projectId}/secrets/${secretId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchSecrets(token);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 80px' }}>
        <Link href={`/dashboard/project/${projectId}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--ink-3)', marginBottom: 22, textDecoration: 'none',
        }}>
          ← Zurück zum Projekt
        </Link>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, marginBottom: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div className="gobl-eyebrow" style={{ marginBottom: 12 }}>
              <span className="tick" />
              <span className="num">/SECRETS · {env.toUpperCase()}</span>
              Verschlüsselt gespeichert
            </div>
            <h1 style={{
              fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              fontWeight: 600, fontSize: 'clamp(32px, 4vw, 48px)',
              letterSpacing: '-0.030em', lineHeight: 1.06,
              color: 'var(--ink-1)', margin: '0 0 12px',
            }}>
              Projekt-<span className="gobl-serif">Secrets.</span>
            </h1>
          </div>

          {/* Environment switcher */}
          <div style={{
            display: 'flex', gap: 4, background: 'var(--d-surface-elev)',
            border: '1px solid var(--line)', borderRadius: 999, padding: 4,
          }}>
            {ENVIRONMENTS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEnv(e)}
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  fontWeight: 600, letterSpacing: '0.12em', padding: '7px 14px',
                  borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: env === e ? 'var(--green)' : 'transparent',
                  color: env === e ? 'var(--bone)' : 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Plain-language explainer — what is a secret, for non-tech users. */}
        <p style={{
          fontSize: 'var(--t-body-fs)', color: 'var(--ink-2)', maxWidth: '64ch',
          margin: '0 0 24px', lineHeight: 1.5,
        }}>
          Secrets sind Passwörter, die deine App braucht, um mit anderen Diensten zu sprechen
          (z. B. Stripe oder deine Datenbank). Goblin speichert sie verschlüsselt — sie tauchen
          nie im Chat auf, nicht in Logs, und Goblin selbst kann sie nicht lesen.
          <em style={{ color: 'var(--ink-3)', fontStyle: 'normal', display: 'block', marginTop: 6, fontSize: 13.5 }}>
            Hinweis: Die automatische Einspeisung in Deploys ist noch nicht aktiv —
            speichern, ansehen und löschen funktioniert bereits.
          </em>
        </p>

        {/* Re-auth banner — only when we have NO reauth token yet. */}
        {!reauthToken && (
          <div style={{
            background: 'var(--accent-soft)', border: '1px solid var(--accent-rule)',
            borderRadius: 'var(--radius)', padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
            flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--accent)', fontSize: 20 }}>🛡</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontWeight: 600, fontSize: 'var(--t-small-fs)', color: 'var(--ink-1)', marginBottom: 2,
              }}>
                Bestätige, dass du es bist
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                Werte einzusehen braucht eine frische Anmeldung — Schutz gegen geöffnete Browser-Sessions.
              </div>
            </div>
            <button type="button" className="gobl-btn gold sm" onClick={() => setReauthModal(true)}>
              Bestätigen
            </button>
          </div>
        )}

        {/* Secrets list. Vault model: each row is one secret. NEVER a file. */}
        {loading ? (
          <div style={{ ...PANEL_OUT, padding: 24, color: 'var(--ink-3)', fontSize: 'var(--t-small-fs)' }}>
            Lade …
          </div>
        ) : (
          <div style={PANEL_OUT}>
            <div style={{
              padding: '10px 20px', background: 'var(--d-surface-2)',
              borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                color: 'var(--ink-3)', fontWeight: 600,
              }}>
                {secrets.length} SECRET{secrets.length === 1 ? '' : 'S'} · {env.toUpperCase()}
              </span>
              <button type="button" className="gobl-btn primary sm" onClick={() => setAddModal(true)}>
                + Hinzufügen
              </button>
            </div>

            {secrets.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 'var(--t-small-fs)' }}>
                Noch keine Secrets für <b>{env}</b>. Goblin sagt dir im Chat, was deine App braucht.
              </div>
            ) : (
              secrets.map((s, i) => {
                const guide = whereDoIGetThis(s.name);
                const guideOpen = openGuide === s.id;
                const revealed = revealedValues[s.id];
                return (
                  <div key={s.id} style={{
                    borderBottom: i === secrets.length - 1 ? 'none' : '1px solid var(--line)',
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) 110px 80px',
                      gap: 14, alignItems: 'center', padding: '14px 20px',
                    }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5,
                        color: 'var(--ink-1)', fontWeight: 500, letterSpacing: '0.02em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {s.name}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5,
                        color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6,
                        minWidth: 0, overflow: 'hidden',
                      }}>
                        {revealed ? (
                          <span style={{ color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {revealed}
                          </span>
                        ) : (
                          <span>•••••••••••• {s.value_hint ? `· ${s.value_hint}` : ''}</span>
                        )}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                        color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        {new Date(s.updated_at).toLocaleDateString('de-DE')}
                      </span>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          title={revealed ? 'Wert ausblenden' : 'Wert anzeigen'}
                          aria-label={revealed ? 'Wert ausblenden' : 'Wert anzeigen'}
                          onClick={() => revealed
                            ? setRevealedValues(p => { const n = { ...p }; delete n[s.id]; return n; })
                            : handleReveal(s.id)}
                          disabled={revealLoading === s.id}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--ink-3)', padding: 4,
                          }}
                        >
                          {revealLoading === s.id ? '…' : revealed ? '🙈' : '👁'}
                        </button>
                        <button
                          type="button"
                          title="Löschen"
                          aria-label="Löschen"
                          onClick={() => handleDelete(s.id)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--ink-3)', padding: 4,
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Per-secret collapsible "where do I get this" — for non-technical users. */}
                    {guide && (
                      <div style={{ padding: '0 20px 12px' }}>
                        <button
                          type="button"
                          onClick={() => setOpenGuide(guideOpen ? null : s.id)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                            letterSpacing: '0.10em', textTransform: 'uppercase',
                            color: 'var(--ink-3)', padding: '4px 0',
                          }}
                        >
                          {guideOpen ? '− ' : '+ '}Wo bekomme ich den?
                        </button>
                        {guideOpen && (
                          <div style={{
                            background: 'var(--d-surface)', border: '1px solid var(--line)',
                            borderRadius: 'var(--radius-sm)', padding: '10px 12px',
                            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 4,
                          }}>
                            {guide}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Add modal */}
        {addModal && (
          <div role="dialog" aria-modal="true" style={{
            position: 'fixed', inset: 0, background: 'rgba(15,43,30,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={() => setAddModal(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--d-surface-elev)', borderRadius: 'var(--radius-lg)',
              padding: 28, width: 420, maxWidth: '92vw', border: '1px solid var(--line)',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontWeight: 600, fontSize: 18, color: 'var(--ink-1)', margin: '0 0 14px',
              }}>
                Secret hinzufügen
              </h2>
              <label className="gobl-field-label" htmlFor="sec-name">Name (UPPER_SNAKE_CASE)</label>
              <input
                id="sec-name"
                value={newName}
                onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                placeholder="DATABASE_URL"
                className="gobl-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                style={{ fontFamily: 'JetBrains Mono, monospace', marginBottom: 14 }}
              />
              <label className="gobl-field-label" htmlFor="sec-val">Wert (wird beim Speichern verschlüsselt)</label>
              <input
                id="sec-val"
                type="password"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="••••••••"
                className="gobl-input"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                style={{ fontFamily: 'JetBrains Mono, monospace', marginBottom: 20 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="gobl-btn secondary" style={{ flex: 1 }} onClick={() => setAddModal(false)}>
                  Abbrechen
                </button>
                <button type="button" className="gobl-btn primary" style={{ flex: 1 }} onClick={handleAdd} disabled={saving || !newName || !newValue}>
                  {saving ? 'Speichere …' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Re-auth modal — gates reveal. Backed by Supabase signInWithPassword. */}
        {reauthModal && (
          <div role="dialog" aria-modal="true" style={{
            position: 'fixed', inset: 0, background: 'rgba(15,43,30,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          }}>
            <div style={{
              background: 'var(--d-surface-elev)', borderRadius: 'var(--radius-lg)',
              padding: 28, width: 380, maxWidth: '92vw', border: '1px solid var(--line)',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                fontWeight: 600, fontSize: 18, color: 'var(--ink-1)', margin: '0 0 8px',
              }}>
                Bestätige deine Identität
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px', lineHeight: 1.5 }}>
                Gib dein Passwort ein, um Werte einzusehen.
              </p>
              <input
                type="password"
                value={reauthPassword}
                onChange={e => setReauthPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReauth()}
                placeholder="Dein Passwort"
                className="gobl-input"
                style={{ marginBottom: reauthError ? 6 : 18 }}
                autoFocus
              />
              {reauthError && (
                <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--danger)', margin: '0 0 12px' }}>
                  {reauthError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="gobl-btn secondary" style={{ flex: 1 }} onClick={() => { setReauthModal(false); setReauthPassword(''); setReauthError(null); }}>
                  Abbrechen
                </button>
                <button type="button" className="gobl-btn primary" style={{ flex: 1 }} onClick={handleReauth} disabled={reauthLoading || !reauthPassword}>
                  {reauthLoading ? 'Prüfe …' : 'Bestätigen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
