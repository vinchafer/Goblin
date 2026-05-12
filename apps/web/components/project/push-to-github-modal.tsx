"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PushToGitHubModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultName: string;
}

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

const FIELD = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--panel)',
  color: 'var(--text)', fontSize: 14, fontFamily: 'DM Sans, sans-serif',
  outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s',
};

export function PushToGitHubModal({ open, onClose, projectId, defaultName }: PushToGitHubModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/github/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, name, description, isPrivate }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Push failed — check your GitHub connection and try again.');
      }
      const result = await res.json() as { url: string };
      setSuccessUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(defaultName); setDescription(''); setIsPrivate(true);
    setLoading(false); setError(null); setSuccessUrl(null);
    onClose();
  };

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
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitHubIcon size={18} /> Push to GitHub
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--meta)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {successUrl ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(74,124,59,0.12)', margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--good)',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontFamily: 'Fraunces, serif' }}>Pushed to GitHub!</h3>
              <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20, fontFamily: 'DM Sans, sans-serif' }}>Your project is now on GitHub.</p>
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', background: 'var(--moss)', color: '#fff',
                  borderRadius: 9, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                <GitHubIcon size={14} /> View on GitHub →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
                  Repository name
                </label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  pattern="[a-zA-Z0-9-_]+" placeholder="my-awesome-project"
                  required style={FIELD}
                  onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>
                  Letters, numbers, hyphens, and underscores only.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
                  Description <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What does this project do?" style={FIELD}
                  onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                <input
                  type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--moss)', cursor: 'pointer' }}
                />
                Private repository
              </label>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(184,92,60,0.08)', border: '1px solid rgba(184,92,60,0.2)', color: 'var(--danger)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name}
                style={{
                  width: '100%', padding: '11px 0',
                  background: loading || !name ? 'rgba(45,74,43,0.4)' : 'var(--moss)',
                  color: '#fff', border: 'none', borderRadius: 9,
                  fontSize: 14, fontWeight: 600, cursor: loading || !name ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!loading && name) e.currentTarget.style.background = 'var(--moss-2)'; }}
                onMouseLeave={e => { if (!loading && name) e.currentTarget.style.background = 'var(--moss)'; }}
              >
                <GitHubIcon size={15} />
                {loading ? 'Pushing…' : 'Push to GitHub'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
