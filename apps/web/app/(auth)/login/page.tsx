'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'sent'|'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    setStatus('loading');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? 'error' : 'sent');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left — Moss panel */}
      <div style={{ width: '42%', background: 'var(--moss)', padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} className="hide-mobile">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: 'var(--ochre)', fontWeight: 700 }}>Goblin.</div>
        <div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 48, color: '#fff', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 24 }}>
            The cloud<br />workshop for<br /><em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>builders.</em>
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['No token panic — ever','Build from your phone','Ship to GitHub in one tap'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(201,147,58,0.15)', border: '1px solid rgba(201,147,58,0.35)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--ochre)', flexShrink: 0 }}>✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© 2026 Goblin</div>
      </div>

      {/* Right — Form */}
      <div style={{ flex: 1, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {status !== 'sent' ? (
            <>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 32, color: 'var(--moss)', fontWeight: 700, marginBottom: 8, letterSpacing: '-1px' }}>Welcome back.</h2>
              <p style={{ fontSize: 15, color: 'var(--meta)', marginBottom: 36, lineHeight: 1.5, fontWeight: 300 }}>Enter your email — we will send a magic link. No password needed.</p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  style={{ width: '100%', height: 52, padding: '0 16px', borderRadius: 10, fontSize: 16, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                />
                <button type="submit" disabled={status === 'loading'} style={{
                  width: '100%', height: 52, background: 'var(--moss)', color: '#fff', border: 'none',
                  borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}>
                  {status === 'loading' ? 'Sending…' : 'Send magic link →'}
                </button>
                {status === 'error' && <p style={{ color: '#c0392b', fontSize: 13, textAlign: 'center' }}>Something went wrong. Please try again.</p>}
              </form>
              <p style={{ marginTop: 24, fontSize: 12, color: 'var(--meta)', textAlign: 'center', fontWeight: 300 }}>No password. No friction. Just your email.</p>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(74,124,59,0.1)', border: '2px solid #4a7c3b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 24px' }}>✓</div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: 'var(--moss)', fontWeight: 700, marginBottom: 8 }}>Check your inbox.</h2>
              <p style={{ fontSize: 15, color: 'var(--meta)', lineHeight: 1.6, fontWeight: 300 }}>Magic link sent to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />Click the link to sign in instantly.</p>
              <button onClick={() => setStatus('idle')} style={{ marginTop: 24, background: 'none', border: 'none', color: 'var(--meta)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Use a different email</button>
            </div>
          )}
        </div>
      </div>
      <style>{`.hide-mobile { display: flex; } @media (max-width: 768px) { .hide-mobile { display: none !important; } }`}</style>
    </div>
  );
}
