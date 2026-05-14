'use client';

import { useState, useEffect, useCallback } from 'react';
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

const CARD = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 };

export default function ProjectSecretsPage() {
  const params = useParams();
  const projectId = params.id as string;

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
        setReauthError('Incorrect password.');
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
    if (!reauthToken) {
      setReauthModal(true);
      return;
    }
    setRevealLoading(secretId);
    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/secrets/${secretId}/reveal`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Reauth-Token': reauthToken },
      });
      if (res.status === 401) {
        setReauthToken(null);
        setReauthModal(true);
        return;
      }
      if (res.ok) {
        const d = await res.json();
        setRevealedValues(prev => ({ ...prev, [secretId]: d.value }));
      }
    } finally {
      setRevealLoading(null);
    }
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
        setAddModal(false);
        setNewName('');
        setNewValue('');
        await fetchSecrets(token);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (secretId: string) => {
    if (!token || !confirm('Delete this secret?')) return;
    await fetch(`${apiBase}/api/projects/${projectId}/secrets/${secretId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchSecrets(token);
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--meta)' }}>Loading secrets…</div>;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>
          Project Secrets
        </h1>
        <button
          onClick={() => setAddModal(true)}
          style={{ background: 'var(--moss)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          + Add Secret
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', marginBottom: 24, lineHeight: 1.6 }}>
        Secrets are encrypted with your account key and injected as environment variables during builds.
        Values are never shown in logs or committed to Git.
      </p>

      {/* Environment tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {ENVIRONMENTS.map(e => (
          <button key={e} onClick={() => setEnv(e)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize',
            background: env === e ? 'var(--moss)' : 'var(--subtle)',
            color: env === e ? '#fff' : 'var(--meta)',
          }}>
            {e}
          </button>
        ))}
      </div>

      {/* Secrets list */}
      {secrets.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
            No secrets for {env}. Click &ldquo;+ Add Secret&rdquo; to create one.
          </div>
        </div>
      ) : (
        secrets.map(secret => (
          <div key={secret.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>
                  {secret.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Mono, monospace' }}>
                  {revealedValues[secret.id]
                    ? revealedValues[secret.id]
                    : `••••••••${secret.value_hint ?? '????'}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => revealedValues[secret.id]
                    ? setRevealedValues(prev => { const n = { ...prev }; delete n[secret.id]; return n; })
                    : handleReveal(secret.id)}
                  disabled={revealLoading === secret.id}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}
                >
                  {revealLoading === secret.id ? '…' : revealedValues[secret.id] ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() => handleDelete(secret.id)}
                  style={{ background: 'transparent', border: '1px solid rgba(184,92,60,0.3)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Add Secret Modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 28, width: 400, maxWidth: '90vw' }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', marginBottom: 20 }}>Add Secret</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', display: 'block', marginBottom: 6 }}>Name (UPPER_SNAKE_CASE)</label>
            <input value={newName} onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="DATABASE_URL"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Mono, monospace', marginBottom: 12, background: 'var(--subtle)', color: 'var(--text)', boxSizing: 'border-box' }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', display: 'block', marginBottom: 6 }}>Value</label>
            <input type="password" value={newValue} onChange={e => setNewValue(e.target.value)}
              placeholder="Value is encrypted before saving"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Mono, monospace', marginBottom: 20, background: 'var(--subtle)', color: 'var(--text)', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAddModal(false)} style={{ flex: 1, padding: '9px 0', background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving || !newName || !newValue} style={{ flex: 1, padding: '9px 0', background: 'var(--moss)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Secret'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-auth Modal */}
      {reauthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 28, width: 360, maxWidth: '90vw' }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', marginBottom: 8 }}>Confirm your identity</h2>
            <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', marginBottom: 20, lineHeight: 1.6 }}>Enter your password to reveal secret values.</p>
            <input type="password" value={reauthPassword} onChange={e => setReauthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReauth()}
              placeholder="Your password"
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${reauthError ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', marginBottom: reauthError ? 6 : 20, background: 'var(--subtle)', color: 'var(--text)', boxSizing: 'border-box' }} />
            {reauthError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>{reauthError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setReauthModal(false); setReauthPassword(''); setReauthError(null); }} style={{ flex: 1, padding: '9px 0', background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={handleReauth} disabled={reauthLoading || !reauthPassword} style={{ flex: 1, padding: '9px 0', background: 'var(--moss)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: reauthLoading ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: 'DM Sans, sans-serif', opacity: reauthLoading ? 0.6 : 1 }}>
                {reauthLoading ? 'Verifying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
