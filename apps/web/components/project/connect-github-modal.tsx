"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ConnectGitHubModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

function GitHubIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

export function ConnectGitHubModal({ open, onClose, onConnected }: ConnectGitHubModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/github/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Could not reach GitHub — try again in a moment.');
      const data = await res.json() as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setLoading(false); setError(null); onClose(); };

  return (
    <div
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--panel)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', maxWidth: 440, width: '100%', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Connect GitHub</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--meta)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(45,74,43,0.1)', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand-green)',
            }}>
              <GitHubIcon size={24} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
              Push your project to GitHub
            </h3>
            <p style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
              Connect your GitHub account once — then push any project with one click. We create a private repo and upload your files.
            </p>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(184,92,60,0.08)', border: '1px solid rgba(184,92,60,0.2)', color: 'var(--danger)', fontSize: 13, fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleConnect}
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0',
                background: loading ? 'rgba(45,74,43,0.5)' : 'var(--brand-green)',
                color: '#fff', border: 'none', borderRadius: 9,
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--green-600)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--brand-green)'; }}
            >
              <GitHubIcon size={16} />
              {loading ? 'Opening GitHub…' : 'Connect GitHub'}
            </button>
            <button
              onClick={handleClose}
              style={{
                width: '100%', padding: '9px 0',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--meta)', borderRadius: 9,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Not now
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 14, fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
            You'll be redirected to GitHub to authorize Goblin.<br />
            We only request repo-creation access — nothing else.
          </p>
        </div>
      </div>
    </div>
  );
}
