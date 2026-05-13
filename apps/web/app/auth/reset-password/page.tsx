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

  useEffect(() => {
    // Supabase puts the tokens in the URL hash — the client SDK handles it automatically
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Also handle code-based flow
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) toast.error('Reset link expired. Request a new one.');
        else setReady(true);
      });
    }
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
    toast.success('Password updated!');
    router.push('/dashboard');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 10, fontSize: 14, color: '#fff', outline: 'none',
    fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    boxSizing: 'border-box',
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">Goblin.</div>
      <div className="auth-card-wrapper">
        <h1 className="auth-card-title">Set new password</h1>
        <p className="auth-card-subtitle">Choose a strong password for your account.</p>
        {ready ? (
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
                background: password && confirm ? 'var(--moss)' : 'rgba(255,255,255,0.06)',
                color: password && confirm ? '#fff' : 'rgba(255,255,255,0.2)',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Updating…' : 'Set password'}
            </button>
          </form>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' }}>
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
