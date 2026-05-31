'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (err) setError('Reset link expired or already used. Request a new one.');
        else setReady(true);
      });
    } else {
      // No code param — show error after brief delay (allow hash-based flow to fire)
      const timer = setTimeout(() => {
        if (!ready) setError('Invalid reset link. Request a new password reset.');
      }, 2000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Password updated! Please sign in.');
    router.push('/login');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 10, fontSize: 'var(--t-small-fs)', color: '#fff', outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">Goblin.</div>
      <div className="auth-card-wrapper">
        <h1 className="auth-card-title">Set new password</h1>
        <p className="auth-card-subtitle">Choose a strong password for your account.</p>
        {error ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: 'var(--t-small-fs)', marginBottom: 16 }}>{error}</p>
            <a href="/login" style={{ color: 'var(--brand-green)', fontSize: 'var(--t-small-fs)', textDecoration: 'none' }}>
              ← Back to sign in
            </a>
          </div>
        ) : ready ? (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password (min. 8 chars)"
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password"
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              style={{
                height: 48,
                background: password && confirm ? 'var(--brand-green)' : 'rgba(255,255,255,0.06)',
                color: password && confirm ? '#fff' : 'rgba(255,255,255,0.2)',
                border: 'none', borderRadius: 10,
                fontSize: 'var(--t-small-fs)', fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Updating…' : 'Set password'}
            </button>
          </form>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--t-small-fs)', textAlign: 'center' }}>
            Verifying reset link…
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
